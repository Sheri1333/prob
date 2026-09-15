#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

exec 9>"$ROOT/.deploy.lock"
flock 9

echo "==> $(date -Iseconds) deploy in $ROOT"

git fetch origin
git checkout main
git reset --hard origin/main

npm ci
npm ci --prefix server
npm run build

mkdir -p server/data/uploads
sudo systemctl restart talapker-api
sudo nginx -t
sudo systemctl reload nginx

echo "==> health"
for i in $(seq 1 15); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null; then
    curl -fsS http://127.0.0.1/api/health
    echo
    echo "==> done"
    exit 0
  fi
  sleep 2
done
echo "API did not become healthy"
systemctl status talapker-api --no-pager || true
exit 1
