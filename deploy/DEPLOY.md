# Deploying Pesarc web to a DigitalOcean Droplet (Podman)

The app is a standard Next.js 15 **standalone** server in an OCI image — it runs
identically under Docker or Podman, on a Droplet, Fly, k8s, or any VPS. This
guide uses **Podman** (daemonless, rootless, OCI — the lightweight Docker
alternative) on Ubuntu 24.04. The same `Dockerfile` builds under either tool.

Nothing here is DigitalOcean-specific except the registry hostname — the image is
your portability guarantee: `podman save` / re-`pull` moves it anywhere.

## 0. Build strategy (important on a small droplet)
`next build` needs ~1.5–2 GB RAM. A $4 (512 MB–1 GB) droplet will OOM building
in place. Two options:

- **Build elsewhere, run on the droplet (recommended).** Build the amd64 image on
  your Mac/CI and push to a registry (DO Container Registry or GHCR), then the
  droplet just pulls + runs — staying light.
- **Build on the droplet** only if you add swap (see step 5) and use a ≥2 GB droplet.

The droplet is `amd64`, so build for that platform explicitly from an ARM Mac:

```bash
# On your Mac / CI (from the repo root, with the real .env present)
doctl registry login                      # or: docker login ghcr.io
docker build --platform linux/amd64 \
  --secret id=dotenv,src=.env \
  -t registry.digitalocean.com/pesarc/pesarc-web:latest .
docker push registry.digitalocean.com/pesarc/pesarc-web:latest
```

> `--secret id=dotenv,src=.env` mounts the env **only during build** so
> `NEXT_PUBLIC_*` inline into the client bundle — **no secret is baked into a
> layer**. Server-only secrets (DATABASE_URL, PAYSTACK_SECRET_KEY, `*_PK`,
> RAMP_*) are read at **runtime** from the env file in step 4.

## 1. Prepare the droplet
```bash
ssh root@YOUR_DROPLET_IP
apt-get update && apt-get install -y podman caddy curl
# Non-root user for the app (optional but recommended):
adduser --system --group pesarc
```

## 2. Registry login on the droplet
```bash
# DO Container Registry:
podman login registry.digitalocean.com   # paste a DO API token as password
# or GHCR: podman login ghcr.io
```

## 3. Runtime env (secrets stay off the image)
Copy the app's `.env` to the droplet, root-readable only:
```bash
mkdir -p /etc/pesarc
scp .env root@YOUR_DROPLET_IP:/etc/pesarc/pesarc.env   # from your Mac
chmod 600 /etc/pesarc/pesarc.env
```
Set a real `DATABASE_URL` here (fix the current bad Neon credential), plus
`PAYSTACK_SECRET_KEY` etc. `NEXT_PUBLIC_*` are already baked into the image at
build, but keeping them in this file too is harmless.

## 4. Run it (systemd-managed via Quadlet)
Copy all three units to `/etc/containers/systemd/` — the shared network, the
Postgres DB, and the web app — edit the web unit's `Image=` line to your
registry tag, then bring them up:
```bash
cp deploy/pesarc.network deploy/pesarc-db.container deploy/pesarc-web.container \
   /etc/containers/systemd/
# db.env holds POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB (chmod 600)
sudo systemctl daemon-reload
sudo systemctl start pesarc-db        # start Postgres first
sudo systemctl start pesarc-web
systemctl status pesarc-web           # should be active (running)
curl -fsS http://127.0.0.1:3000/ | head -c 200
```
`DATABASE_URL` in `pesarc.env` reaches the DB by container name:
`postgres://pesarc:<pw>@pesarc-db:5432/pesarc`. That name only resolves once the
firewall lets containers reach aardvark-dns — **do section 6's ufw rules or every
DB call hangs and silently falls back to an ephemeral file store.**

Run the schema once against the live DB (idempotent):
```bash
podman cp deploy/schema.sql pesarc-db:/tmp/schema.sql   # or pipe scripts/migrate.mjs' DDL
podman exec pesarc-db psql -U pesarc -d pesarc -f /tmp/schema.sql
```

`AutoUpdate=registry` + `podman auto-update` (or a timer) pulls new images on
redeploy. Quadlet restarts the container on crash/boot.

## 5. (Only if building on the droplet) add swap
```bash
fallocate -l 3G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 6. HTTPS + domain (Caddy)
Point an A record (e.g. `app.pesarc.xyz`) at the droplet IP. Put
`deploy/Caddyfile` at `/etc/caddy/Caddyfile` (replace the domain), then:
```bash
systemctl reload caddy      # auto-provisions a Let's Encrypt cert
ufw allow 80,443/tcp && ufw allow OpenSSH && ufw --force enable
```
The container only listens on `127.0.0.1:3000`; Caddy is the public TLS edge.

### Firewall — REQUIRED for container DNS (Podman + ufw gotcha)
ufw's defaults break Podman's networking in two ways, and the symptom is nasty:
containers can't resolve **any** name (not `pesarc-db`, not `api.paystack.co`),
so DB writes hang then fall back to a throwaway file store and external API calls
fail — all silently. Container→container TCP still works, which makes it look
like only DNS is broken. Fixes, against the pinned `10.89.0.0/24` subnet:
```bash
# 1. Let containers reach aardvark-dns on the bridge gateway (10.89.0.1:53).
#    This is what makes both internal names AND external DNS resolve.
ufw allow from 10.89.0.0/24 comment 'podman containers -> host (DNS/aardvark)'

# 2. Allow forwarded traffic so containers can reach the internet (netavark NATs).
sed -i 's/^DEFAULT_FORWARD_POLICY=.*/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw
ufw reload
```
Verify from inside the app container:
```bash
podman exec pesarc-web getent hosts pesarc-db          # -> 10.89.0.x
podman exec pesarc-web node -e 'require("dns").resolve4("api.paystack.co",(e,a)=>console.log(e||a))'
```
Both must return quickly. A ~6 s hang means the ufw rules aren't applied.

## 7. Settlement cron (replaces vercel.json)
Copy `deploy/pesarc-solve.service` and `deploy/pesarc-solve.timer` to
`/etc/systemd/system/`, then:
```bash
systemctl enable --now pesarc-solve.timer
systemctl list-timers pesarc-solve.timer
```
No Hobby-plan cap here — the timer defaults to every 5 minutes.

## 7b. Database backups (nightly, free/local)
Copy `deploy/pesarc-db-backup.sh` to `/usr/local/bin/` (chmod 755) and the
service+timer to `/etc/systemd/system/`, then:
```bash
systemctl enable --now pesarc-db-backup.timer
systemctl start pesarc-db-backup.service     # run one now
ls -lh /var/backups/pesarc/                   # gzipped dumps, rotated (14 days)
```
Dumps go to the droplet's own disk — no paid service. **Restore:**
```bash
zcat /var/backups/pesarc/pesarc-YYYYmmdd-HHMMSS.sql.gz \
  | podman exec -i pesarc-db psql -U pesarc -d pesarc
```
Local dumps do NOT survive losing the whole droplet. For that, add an off-box
copy (the only paid part — DO Spaces ~$5/mo or any S3) at the end of the script:
`s3cmd put "$out" s3://<bucket>/pesarc/` (or `rclone copy`).

## 8. Redeploy
Build + push a new image (step 0), then on the droplet:
```bash
podman pull <your image>
systemctl restart pesarc-web
# or enable podman-auto-update.timer to do it automatically
```

## CI/CD — one `git push` (GitHub Actions)
`.github/workflows/build-image.yml` builds the amd64 image on every push to
`main` and pushes it to **GHCR** (`ghcr.io/pesarc/pesarc-web`), so you never build
on the droplet. Set up:

1. Repo secret **`BUILD_DOTENV`** = the `NEXT_PUBLIC_*` lines from `app/.env`
   (these inline into the client bundle at build; keep server secrets OUT — they
   live only in `/etc/pesarc/pesarc.env` on the droplet).
2. To auto-deploy after each build, set repo variable **`DEPLOY_TO_DROPLET=true`**
   and secrets **`DROPLET_HOST`**, **`DROPLET_USER`**, **`DROPLET_SSH_KEY`**. The
   deploy job SSHes in and runs `podman pull … && systemctl restart pesarc-web`.
3. On the droplet, log in so Podman can pull the private image:
   `podman login ghcr.io -u <github-user>` (password = a PAT with `read:packages`),
   or make the GHCR package public. `doctl registry login` instead if you prefer DOCR.

That's the "one git push" deploy. Without step 2 it still builds+pushes; you pull
manually (step 8 below).

## Moving to another stack later
The artifact is a plain OCI image + a Postgres URL. To leave DigitalOcean:
`podman push` the image to any registry and run it on Fly/Render/k8s/another VPS
with the same env file. The DB is self-hosted Postgres in the `pesarc-db`
container (volume `pesarc-db-data`) — move it with `pg_dump | pg_restore`, or
point `DATABASE_URL` at any managed Postgres (Neon, DO Managed, RDS): the driver
(`postgres` / postgres.js) speaks standard TCP + optional TLS, so nothing is tied
to the host. Nothing else is host-specific.
