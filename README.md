# Financeiro

Sistema financeiro pessoal para importar extratos CSV do Nubank, categorizar
transacoes, revisar lancamentos e acompanhar orcamento previsto.

## Stack

- Monorepo `pnpm`
- API: Fastify + TypeScript + Drizzle ORM + PostgreSQL
- Web: Vue 3 + Vite + PrimeVue + Pinia
- Desktop: Electron apontando para a web
- Banco local: PostgreSQL externo (`localhost:5432`); producao: PostgreSQL em Docker na VPS

## Estrutura

- `apps/api`: API, autenticacao, rotas, migrations e acesso ao banco
- `apps/web`: interface principal
- `apps/electron`: wrapper desktop
- `packages/shared`: schemas e tipos compartilhados
- `docs`: documentacao tecnica e guias
- `planos`: planos de implementacao/investigacao
- `dados`: CSVs auxiliares e saidas locais dos scripts legados
- `exemplo_input`: CSVs Nubank de exemplo para testes manuais

## Rodar local

Instale dependencias:

```powershell
pnpm install
```

Configure o banco local (Postgres fora do Docker) em `apps/api/.env` e aplique
migrations/seeds:

```powershell
copy apps\api\.env.example apps\api\.env
pnpm db:migrate
pnpm db:seed
```

O padrao local aponta para `postgres://postgres:postgres@localhost:5432/financeiro`.
Se precisar de outro host, usuario ou senha, ajuste `DATABASE_URL` no `.env`.
O `docker-compose.yml` (porta `5433`) e opcional — use `pnpm db:up` so se quiser
um Postgres isolado via Docker.

Rode API e web:

```powershell
pnpm dev
```

A web local roda em:

```text
http://localhost:5173
```

## Desktop

Para abrir o Electron em desenvolvimento:

```powershell
.\scripts\windows\iniciar.bat
```

Para apontar o Electron para producao:

```powershell
$env:FINANCEIRO_APP_URL="http://66.23.231.218"
pnpm --filter @financeiro/electron start:prod
```

## Producao

O deploy usa GitHub Actions e VPS via SSH. Arquivos principais:

- `.github/workflows/deploy.yml`
- `docker-compose.prod.yml`
- `Dockerfile.api`
- `Dockerfile.web`
- `deploy/Caddyfile`
- `deploy/Caddyfile.host.example`
- `deploy/faruk-site/index.html`
- `scripts/deploy-vps.sh`

Variaveis esperadas na VPS em `/opt/financeiro/.env`:

```env
POSTGRES_PASSWORD=...
AUTH_SECRET=...
AUTH_COOKIE_SECURE=true
WEB_PORT=8081
```

Em VPS com mais de um projeto, o recomendado e usar um Caddy central no host
para publicar:

- `financeiro.faruk.dev.br` -> `127.0.0.1:8081`
- `faruk.dev.br` e `www.faruk.dev.br` -> outro projeto ou site estatico

Guia completo: `docs/vps-multisite-faruk.md`

## Scripts legados

Scripts Python legados ajudam a classificar extratos e gerar CSVs auxiliares:

```powershell
python scripts\legacy\bootstrap_merchants.py
python scripts\legacy\categorizar_extrato.py NU_941505780_01JUN2026_07JUN2026.csv
```

Dados usados por esses scripts ficam em:

- `dados/csv/merchants_para_classificar.csv`
- `dados/output/`
- `dados/sheets/`
- `dados/exports/`

## Documentacao

Comece por:

- `docs/AGENTS.md`
- `docs/PLANO_SISTEMA.md`
- `docs/parser-categorizacao-nubank.md`
