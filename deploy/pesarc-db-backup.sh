#!/usr/bin/env bash
# Nightly Postgres backup for Pesarc — local, compressed, rotated. No paid deps:
# it writes to the droplet's own disk. Install to /usr/local/bin/ (chmod 755),
# driven by pesarc-db-backup.timer.
#
# Restore a dump:
#   zcat /var/backups/pesarc/pesarc-YYYYmmdd-HHMMSS.sql.gz \
#     | podman exec -i pesarc-db psql -U pesarc -d pesarc
#
# OPTIONAL off-box copy (costs extra — e.g. DO Spaces ~$5/mo): after the local
# dump, `s3cmd put "$out" s3://<bucket>/pesarc/` or `rclone copy`. Off-box is the
# only thing that survives losing the whole droplet; local dumps do not.
set -euo pipefail
BACKUP_DIR=/var/backups/pesarc
RETENTION_DAYS="${RETENTION_DAYS:-14}"
DB_USER="${POSTGRES_USER:-pesarc}"
DB_NAME="${POSTGRES_DB:-pesarc}"
install -d -m 700 "$BACKUP_DIR"
ts="$(date +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/pesarc-$ts.sql.gz"
# Dump via the container (local socket = trust auth); compress on the host.
if podman exec pesarc-db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
     | gzip -9 > "$out.tmp"; then
  mv "$out.tmp" "$out"; chmod 600 "$out"
  echo "backup ok: $out ($(du -h "$out" | cut -f1))"
else
  rm -f "$out.tmp"; echo "pesarc backup FAILED" >&2; exit 1
fi
# Rotate: drop dumps older than retention, but always keep the newest 7.
mapfile -t old < <(find "$BACKUP_DIR" -name 'pesarc-*.sql.gz' -mtime +"$RETENTION_DAYS")
keep=7
total=$(find "$BACKUP_DIR" -name 'pesarc-*.sql.gz' | wc -l)
if (( total - ${#old[@]} >= keep )); then
  printf '%s\n' "${old[@]}" | xargs -r rm -f
fi
