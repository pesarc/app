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
Copy `deploy/pesarc-web.container` to `/etc/containers/systemd/`, edit the
`Image=` line to your registry tag, then:
```bash
sudo systemctl daemon-reload
sudo systemctl start pesarc-web
systemctl status pesarc-web           # should be active (running)
curl -fsS http://127.0.0.1:3000/ | head -c 200
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

## 7. Settlement cron (replaces vercel.json)
Copy `deploy/pesarc-solve.service` and `deploy/pesarc-solve.timer` to
`/etc/systemd/system/`, then:
```bash
systemctl enable --now pesarc-solve.timer
systemctl list-timers pesarc-solve.timer
```
No Hobby-plan cap here — the timer defaults to every 5 minutes.

## 8. Redeploy
Build + push a new image (step 0), then on the droplet:
```bash
podman pull <your image>
systemctl restart pesarc-web
# or enable podman-auto-update.timer to do it automatically
```

## Moving to another stack later
The artifact is a plain OCI image + a Postgres URL. To leave DigitalOcean:
`podman push` the image to any registry and run it on Fly/Render/k8s/another VPS
with the same env file. Neon Postgres is already host-agnostic; DO Managed
Postgres would be a `pg_dump | pg_restore` away. Nothing else is tied to the host.
