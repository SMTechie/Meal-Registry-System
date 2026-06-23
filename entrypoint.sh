#!/bin/sh
set -e

python - <<'PY'
import os
import socket
import time

host = os.getenv("POSTGRES_HOST")
port = int(os.getenv("POSTGRES_PORT", "5432"))
if host:
    deadline = time.time() + 60
    while True:
        try:
            with socket.create_connection((host, port), timeout=2):
                break
        except OSError:
            if time.time() > deadline:
                raise
            time.sleep(1)
PY

BOOTSTRAP_MARKER="${BOOTSTRAP_MARKER:-/app/staticfiles/.bootstrapped}"

if [ "${RUN_BOOTSTRAP:-0}" = "1" ]; then
  python manage.py migrate --noinput
  python manage.py bootstrap_registry
  python manage.py collectstatic --noinput
  mkdir -p "$(dirname "$BOOTSTRAP_MARKER")"
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$BOOTSTRAP_MARKER"
else
  echo "Waiting for bootstrap marker at $BOOTSTRAP_MARKER"
  while [ ! -f "$BOOTSTRAP_MARKER" ]; do
    sleep 1
  done
fi

exec "$@"
