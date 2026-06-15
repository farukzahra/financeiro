# Deploy automatico em VPS via GitHub Actions

## Objetivo

Publicar o sistema financeiro em uma VPS e automatizar o deploy quando houver commit/push no GitHub, preferencialmente na branch principal. O deploy deve rodar build, aplicar migrations e atualizar API/web com o menor risco possivel.

## Decisao proposta

Usar VPS com Docker Compose e GitHub Actions fazendo deploy por SSH.

Arquitetura recomendada:

- PostgreSQL em container com volume persistente na VPS.
- API Node em container, expondo internamente a porta 3001.
- Web Vue servida como arquivos estaticos por Nginx/Caddy.
- Reverse proxy publico com HTTPS.
- GitHub Actions em `push` na branch principal:
  1. roda build/teste no runner;
  2. conecta na VPS por SSH;
  3. atualiza o codigo ou imagens;
  4. roda migrations;
  5. recria containers.

Para este projeto, ha duas rotas possiveis:

1. Simples: VPS faz `git pull`, `pnpm install`, `pnpm build`, `pnpm db:migrate` e reinicia servicos.
2. Mais limpa: GitHub Actions builda imagens Docker, publica no GitHub Container Registry, e a VPS so baixa imagens e reinicia.

Recomendacao: comecar pela rota 1 para ir ao ar rapido; migrar para imagens depois se o deploy ficar lento ou fragil.

## Decisoes importantes

- Nao usar credenciais de producao no repositorio.
- Guardar segredos no GitHub Actions Secrets e em `.env` na VPS.
- Manter producao igual ao dev local na identidade do Postgres:
  - database: `financeiro`
  - user: `financeiro`
  - service/host no Compose: `db`
  - porta interna: `5432`
  - `DATABASE_URL` dentro da rede Docker: `postgres://financeiro:<senha>@db:5432/financeiro`
- A senha pode e deve ser diferente em producao, mas o nome do database e do usuario devem ficar iguais para evitar confusao operacional.
- `AUTH_SECRET` deve ser definido na VPS e nunca trocar depois de usuarios reais logarem, senao cookies existentes deixam de validar.
- `DATABASE_URL` de producao deve apontar para o Postgres da VPS.
- Migrations devem rodar antes de subir a nova API.
- O banco precisa de backup automatico antes de migrations ou pelo menos diario.

## Etapas

### 1. Preparar o repositorio para producao

- Criar `Dockerfile` para API.
- Criar build/serving da web, via Nginx ou Caddy.
- Criar `docker-compose.prod.yml` com:
  - `db`
  - `api`
  - `web` ou `proxy`
- Criar `.env.example` de producao com:
  - `DATABASE_URL`
  - `POSTGRES_USER=financeiro`
  - `POSTGRES_DB=financeiro`
  - `POSTGRES_PASSWORD`
  - `AUTH_SECRET`
  - `PORT`
  - variaveis de proxy/domino se necessario
- Adicionar script de deploy/migration se necessario.

### 2. Preparar a VPS

- Instalar Docker e Docker Compose plugin.
- Criar usuario de deploy sem senha root direta.
- Configurar SSH por chave.
- Configurar firewall liberando apenas:
  - 22/tcp para SSH
  - 80/tcp e 443/tcp para HTTP/HTTPS
- Criar diretorio da aplicacao, exemplo `/opt/financeiro`.
- Criar `.env` de producao em `/opt/financeiro/.env`.
- Configurar dominio apontando para o IP da VPS.

### 3. Configurar HTTPS e proxy

Opcoes:

- Caddy: mais simples, gera TLS automatico.
- Nginx + Certbot: mais manual, mas comum.

Recomendacao: Caddy para reduzir atrito.

Rotas esperadas:

- `/` serve a web.
- `/api/*` encaminha para API, removendo ou preservando prefixo conforme o proxy escolhido.

Hoje a web usa `baseURL: /api`, e no dev o Vite remove `/api`. Em producao ha duas opcoes:

- Configurar proxy para remover `/api` antes da API.
- Ou alterar a API para registrar rotas sob `/api` em producao.

Recomendacao: proxy remover `/api`, mantendo o codigo atual.

### 4. GitHub Actions

Criar workflow `.github/workflows/deploy.yml`:

- Trigger: `push` na branch `main` ou `master`.
- Job 1: checkout, setup pnpm, install, `pnpm build`.
- Job 2: deploy via SSH usando secrets:
  - `VPS_HOST`
  - `VPS_USER`
  - `VPS_SSH_KEY`
  - opcional `VPS_PORT`

Fluxo simples no servidor:

```bash
cd /opt/financeiro
git fetch --all
git reset --hard origin/main
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @financeiro/api db:migrate
docker compose -f docker-compose.prod.yml up -d --build
```

Se usar containers corretamente, preferir rodar `pnpm build` dentro do Dockerfile e executar migrations via container da API.

### 5. Banco e migrations

- Garantir que `apps/api/src/db/migrations` esteja versionado.
- Rodar `pnpm --filter @financeiro/api db:migrate` no deploy.
- Nao rodar seed automaticamente em producao sem decisao explicita.
- Criar backup antes de migrations:

```bash
docker exec financeiro-db pg_dump -U financeiro financeiro > backups/financeiro-$(date +%F-%H%M).sql
```

### 6. Observabilidade minima

- `docker compose logs -f api`
- Health check em `/health`.
- Logrotate ou politica de logs Docker.
- Backup diario do Postgres.

## Riscos e cuidados

- Porta e credenciais locais estao inconsistentes hoje: compose local usa `5433` e usuario/senha/database `financeiro/financeiro/financeiro`, enquanto `.env`/BAT usam `5432 postgres/postgres`. A decisao para VPS e para o padrao novo do projeto deve ser: database `financeiro`, user `financeiro`, host Compose `db`, porta interna `5432`.
- Em dev local, o acesso a partir do host pode continuar usando `localhost:5433`; dentro do Compose/VPS deve ser sempre `db:5432`.
- Cookies dependem de `AUTH_SECRET`; trocar esse segredo desloga usuarios.
- Se o proxy nao remover `/api`, a web chamara rotas erradas.
- Se migrations falharem no meio, o deploy deve parar e nao reiniciar com app parcialmente atualizado.
- Dados financeiros exigem backup antes de qualquer automacao agressiva.

## Ordem de implementacao

1. Criar `docker-compose.prod.yml` e Dockerfiles.
2. Rodar localmente uma simulacao de producao.
3. Criar workflow GitHub Actions apenas com build.
4. Preparar VPS manualmente.
5. Adicionar deploy via SSH no workflow.
6. Adicionar backup antes de migration.
7. Documentar rollback simples.

## Rollback inicial

Para a rota simples por `git pull`, rollback pode ser:

```bash
cd /opt/financeiro
git log --oneline -5
git reset --hard <commit_anterior>
pnpm install --frozen-lockfile
pnpm build
docker compose -f docker-compose.prod.yml up -d --build
```

Atenção: rollback de codigo nao desfaz migration. Por isso migrations devem ser pequenas e reversiveis quando possivel.

## Resultado esperado

Depois de pronto, um push para a branch principal deve:

1. validar build no GitHub;
2. entrar na VPS;
3. atualizar codigo/app;
4. aplicar migrations;
5. reiniciar servicos;
6. deixar o site acessivel via HTTPS.

## Implementado no repositorio em 2026-06-15

Arquivos adicionados:

- `Dockerfile.api`: imagem da API, rodando `tsx src/index.ts` para manter comportamento proximo do dev.
- `Dockerfile.web`: build da web e serving com Caddy.
- `deploy/Caddyfile`: serve a SPA e faz proxy de `/api/*` para `api:3001`, removendo o prefixo `/api`.
- `docker-compose.prod.yml`: Compose de VPS com `db`, `api` e `web`.
- `.env.production.example`: exemplo de variaveis de producao.
- `scripts/deploy-vps.sh`: script chamado na VPS para atualizar codigo, buildar imagens, criar backup, rodar migrations e subir containers.
- `.github/workflows/deploy.yml`: workflow de GitHub Actions com build e deploy SSH.
- `.dockerignore`: reduz contexto do Docker e evita levar `node_modules`, `dist`, Electron e arquivos locais.

Arquivo atualizado:

- `apps/api/.env.example`: passou a sugerir `postgres://financeiro:financeiro@localhost:5433/financeiro`, igual ao `docker-compose.yml` local.
- `apps/electron/main.cjs`: Electron passou a ler `FINANCEIRO_APP_URL`, mantendo `http://localhost:5173` como padrao local.
- `apps/electron/package.json`: adicionado `start:prod`, que exige `FINANCEIRO_APP_URL` definida.

Validacoes feitas:

- `pnpm build`
- `docker compose -f docker-compose.prod.yml config`
- `docker compose -f docker-compose.prod.yml build`
- `caddy validate --config deploy/Caddyfile`

## Electron apontando para producao

O Electron continua local por padrao:

```bash
pnpm --filter @financeiro/electron start
```

Para abrir a instancia da VPS/producao:

```bash
FINANCEIRO_APP_URL=https://financeiro.seudominio.com pnpm --filter @financeiro/electron start:prod
```

No PowerShell:

```powershell
$env:FINANCEIRO_APP_URL="https://financeiro.seudominio.com"
pnpm --filter @financeiro/electron start:prod
```

Quando houver instalador/atalho desktop, ele deve definir `FINANCEIRO_APP_URL` para o dominio de producao.

## Checklist da VPS

### Instalar base

Na VPS, instalar:

- Git
- Docker
- Docker Compose plugin

Exemplo Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Depois sair e entrar de novo no SSH para o grupo `docker` valer.

### Criar diretorio e clonar repo

```bash
sudo mkdir -p /opt/financeiro
sudo chown -R $USER:$USER /opt/financeiro
git clone <URL_DO_REPO_GITHUB> /opt/financeiro
cd /opt/financeiro
```

Se o repo for privado, configurar deploy key ou autenticar o GitHub na VPS.

### Criar `.env` na VPS

Em `/opt/financeiro/.env`:

```bash
POSTGRES_PASSWORD=<senha-forte-do-postgres>
AUTH_SECRET=<segredo-longo-estavel>
SITE_ADDRESS=:80
```

Quando o dominio estiver apontando para a VPS, trocar:

```bash
SITE_ADDRESS=financeiro.seudominio.com
```

Com dominio, Caddy tentara HTTPS automatico. As portas 80 e 443 precisam estar liberadas.

### Primeiro deploy manual

```bash
cd /opt/financeiro
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @financeiro/api db:migrate
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

Verificar:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

### GitHub Secrets

No GitHub, configurar em `Settings > Secrets and variables > Actions`:

- `VPS_HOST`: IP ou host da VPS.
- `VPS_USER`: usuario SSH da VPS.
- `VPS_SSH_KEY`: chave privada SSH que acessa a VPS.
- `VPS_PORT`: opcional; se nao definir, usa `22`.
- `DEPLOY_PATH`: opcional; se nao definir, usa `/opt/financeiro`.

### Deploy automatico

Depois do primeiro deploy manual e dos secrets configurados, push na branch `main` ou `master` dispara:

1. `pnpm install --frozen-lockfile`
2. `pnpm build`
3. SSH na VPS
4. `scripts/deploy-vps.sh`

O script faz backup antes das migrations em:

```text
/opt/financeiro/backups/
```
