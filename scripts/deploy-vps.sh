#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/financeiro}"
DEPLOY_REF="${DEPLOY_REF:-origin/main}"
COMPOSE="docker compose -f docker-compose.prod.yml"

cd "$APP_DIR"

git fetch --all --prune
git reset --hard "$DEPLOY_REF"

mkdir -p backups

$COMPOSE build
$COMPOSE up -d db

until $COMPOSE exec -T db pg_isready -U financeiro -d financeiro >/dev/null 2>&1; do
  echo "Aguardando Postgres..."
  sleep 2
done

BACKUP_FILE="backups/financeiro-$(date +%Y%m%d-%H%M%S).sql"
if $COMPOSE exec -T db pg_dump -U financeiro financeiro > "$BACKUP_FILE"; then
  echo "Backup criado em $BACKUP_FILE"
else
  echo "Backup falhou; abortando deploy antes das migrations."
  exit 1
fi

$COMPOSE run --rm api pnpm --filter @financeiro/api db:migrate
$COMPOSE up -d --remove-orphans

docker image prune -f
