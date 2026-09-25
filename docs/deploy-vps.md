# Deploy na VPS (financeiro)

**Infraestrutura compartilhada:** documentação canônica no repositório [`../vps`](../vps) (`C:\repo\vps`).

| O quê | Onde ler |
|-------|----------|
| IP, hostname, provedor | [`../vps/docs/vps/overview.md`](../vps/docs/vps/overview.md) |
| Apps, portas, paths `/opt/*` | [`../vps/docs/vps/inventory.md`](../vps/docs/vps/inventory.md) |
| SSH e **GitHub Actions secrets** | [`../vps/docs/vps/access.md`](../vps/docs/vps/access.md) |
| Incidentes / deploy CI falhou | [`../vps/docs/vps/runbook.md`](../vps/docs/vps/runbook.md) |
| Caddy / HTTPS | [`../vps/docs/vps/caddy.md`](../vps/docs/vps/caddy.md) |
| Template de secrets Actions | [`../secrets/templates/github-actions-secrets.template.md`](../secrets/templates/github-actions-secrets.template.md) |
| Cofre (chaves, `.env` prod) | `C:\repo\secrets\` |

Este arquivo cobre só o app **financeiro**. DNS e Caddy multi-site: [`vps-multisite-faruk.md`](./vps-multisite-faruk.md).

## Este app em produção

| Campo | Valor |
|-------|--------|
| URL | https://financeiro.faruk.dev.br |
| Repo GitHub | `farukzahra/financeiro` |
| Path na VPS | `/opt/financeiro` |
| Porta no host (Caddy → app) | `127.0.0.1:8081` |
| Workflow CI | `.github/workflows/deploy.yml` (job `deploy` após `build`) |
| Script no servidor | `scripts/deploy-vps.sh` (chamado via SSH pelo Actions) |
| `.env` produção (local) | `C:\repo\secrets\projects\financeiro.env` → copiar para `/opt/financeiro/.env` |

## Onde pegar cada secret do GitHub Actions

Configurar em **GitHub → repositório `farukzahra/financeiro` → Settings → Secrets and variables → Actions**.

| Secret | Valor para o financeiro |
|--------|-------------------------|
| `VPS_HOST` | `92.112.177.249` (Hostinger — ver `../vps/docs/vps/inventory.md`) |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` |
| `DEPLOY_PATH` | `/opt/financeiro` |
| **`VPS_SSH_KEY`** | **Conteúdo completo** do arquivo privado `C:\repo\secrets\vps\ssh\github-actions-vps-shared` (inclui linhas `-----BEGIN … KEY-----` / `-----END … KEY-----`). É a **mesma** chave usada pelo agente local e pelos outros apps na VPS. |

A chave **pública** correspondente (`github-actions-vps-shared.pub`) precisa estar em `/root/.ssh/authorized_keys` na VPS. Após **trocar de servidor**, reinstalar a VPS ou recriar a máquina, é obrigatório registrar de novo o `.pub` (console Hostinger ou sessão SSH que ainda funcione). Sem isso o Actions retorna `Permission denied (publickey)`.

### Definir secrets (igual MACO / terapia)

Mesmos nomes e mesma chave `github-actions-vps-shared` que `farukzahra/maco` e `farukzahra/terapia`.

```powershell
.\scripts\setup-github-secrets.ps1
```

Ou manualmente:

```powershell
$repo = "farukzahra/financeiro"
$key  = "C:\repo\secrets\vps\ssh\github-actions-vps-shared"

gh secret set VPS_HOST      --body "92.112.177.249" --repo $repo
gh secret set VPS_USER      --body "root"            --repo $repo
gh secret set VPS_PORT      --body "22"              --repo $repo
gh secret set DEPLOY_PATH   --body "/opt/financeiro" --repo $repo
Get-Content $key -Raw | gh secret set VPS_SSH_KEY --repo $repo
gh variable set DOMAIN --repo $repo --body "financeiro.faruk.dev.br"
gh variable set WEB_PORT --repo $repo --body "8081"
```

O workflow `.github/workflows/deploy.yml` segue o padrão terapia: `GITHUB_TOKEN` no `git fetch`, clone em `/opt/financeiro` se faltar `.git`, variáveis `DOMAIN` / `WEB_PORT`.

Testar a chave antes de confiar no CI:

```powershell
ssh -i C:\repo\secrets\vps\ssh\github-actions-vps-shared `
  -o BatchMode=yes -o StrictHostKeyChecking=accept-new `
  root@92.112.177.249 "echo ok"
```

Ou no repo `vps`: `.\scripts\vps-ssh.ps1`

## Deploy manual (se o Actions falhar)

```bash
# Na VPS, como root:
APP_DIR=/opt/financeiro DEPLOY_REF=origin/main sh /opt/financeiro/scripts/deploy-vps.sh
```

## Verificação pós-deploy

- `docs/commit-push.json`: `https://financeiro.faruk.dev.br/` deve responder **200** com “Financeiro” no HTML.
- Versão em **Sobre** (`/sobre`) após bump em `docs/release-history.json`.

## Migração de VPS

1. Atualizar DNS `A` → IP novo (hoje `92.112.177.249` — ver `../vps` e Registro.br).
2. Clonar repo em `/opt/financeiro`, copiar `.env` do cofre.
3. Garantir `authorized_keys` com `github-actions-vps-shared.pub`.
4. Atualizar **todos** os secrets `VPS_*` no GitHub (host e chave, se mudou).
5. Re-run do workflow **Deploy VPS** ou push em `main`.

IP antigo (InterServer `66.23.231.218`) está obsoleto desde a migração Hostinger (2026-09).
