#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/financeiro}"
DEPLOY_REF="${DEPLOY_REF:-origin/main}"
COMPOSE="docker compose -f docker-compose.prod.yml"
DOMAIN="${DOMAIN:-financeiro.faruk.dev.br}"
WEB_PORT="${WEB_PORT:-8081}"
GITHUB_REPO="${GITHUB_REPO:-farukzahra/financeiro}"

cd "$APP_DIR"

sync_repo() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    git fetch "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" \
      "+refs/heads/*:refs/remotes/origin/*" --prune
  else
    git fetch --all --prune
  fi
  git reset --hard "$DEPLOY_REF"
}

sync_repo

if [ ! -f .env ]; then
  echo "Arquivo $APP_DIR/.env ausente. Copie .env.production.example e preencha." >&2
  exit 1
fi

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

if [ -f /etc/caddy/Caddyfile ]; then
  python3 - "$DOMAIN" "$WEB_PORT" <<'PY'
import sys
import subprocess

domain, port = sys.argv[1:3]
path = "/etc/caddy/Caddyfile"
content = open(path, encoding="utf-8").read()

block = f"""{domain} {{
\tencode gzip zstd
\treverse_proxy 127.0.0.1:{port}
}}"""

marker = f"{domain} {{"
start = content.find(marker)
if start == -1:
    new = content.rstrip() + "\n\n" + block + "\n"
else:
    depth = 0
    end = start
    for i in range(start, len(content)):
        char = content[i]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    new = content[:start] + block + content[end:]

if new != content:
    open(path, "w", encoding="utf-8").write(new)
    subprocess.run(["systemctl", "reload", "caddy"], check=False)
PY
fi

sleep 4

if ! curl -sf "http://127.0.0.1:${WEB_PORT}/api/health" >/dev/null; then
  echo "Health check falhou em http://127.0.0.1:${WEB_PORT}/api/health" >&2
  exit 1
fi

echo "Deploy concluido: https://${DOMAIN} (porta ${WEB_PORT})"
