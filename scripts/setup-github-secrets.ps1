# Sync GitHub Actions deploy secrets with MACO/terapia (Hostinger VPS).
# Usage: .\scripts\setup-github-secrets.ps1

$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }
$repo = "farukzahra/financeiro"
$keyPath = "C:\repo\secrets\vps\ssh\github-actions-vps-shared"

if (-not (Test-Path $keyPath)) {
  throw "Chave nao encontrada: $keyPath"
}

& $gh secret set VPS_HOST --repo $repo --body "92.112.177.249"
& $gh secret set VPS_USER --repo $repo --body "root"
& $gh secret set VPS_PORT --repo $repo --body "22"
& $gh secret set DEPLOY_PATH --repo $repo --body "/opt/financeiro"
Get-Content $keyPath -Raw | & $gh secret set VPS_SSH_KEY --repo $repo

& $gh variable set DOMAIN --repo $repo --body "financeiro.faruk.dev.br"
& $gh variable set WEB_PORT --repo $repo --body "8081"

Write-Host "Secrets/variables OK for $repo"
