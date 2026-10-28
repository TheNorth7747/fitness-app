#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source ./.env
set +a
mkdir -p backups
chmod 700 backups
umask 077
stamp="$(date +%F-%H%M%S)"
target="backups/fitday-${stamp}.dump"
sudo docker compose exec -T db pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc > "${target}"
test -s "${target}"
find backups -type f -name 'fitday-*.dump' -mtime +14 -delete
echo "backup created: ${target} ($(stat -c%s "${target}") bytes)"
