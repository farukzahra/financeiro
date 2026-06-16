# VPS multisite

Configuracao sugerida para publicar mais de um projeto na mesma VPS usando
um Caddy central no host.

## Objetivo

- `faruk.dev.br` e `www.faruk.dev.br`: pagina pessoal `faruk`
- `financeiro.faruk.dev.br`: sistema financeiro

## Estrutura na VPS

```text
/opt/financeiro
/opt/faruk/site
/etc/caddy/Caddyfile
```

## DNS no Registro.br

```text
A  @           66.23.231.218
A  www         66.23.231.218
A  financeiro  66.23.231.218
```

## Financeiro

O `docker-compose.prod.yml` do financeiro publica apenas:

```text
127.0.0.1:8081 -> container web:80
```

Assim o app continua isolado e o Caddy do host faz o HTTPS e o roteamento por
dominio.

Variaveis importantes em `/opt/financeiro/.env`:

```env
POSTGRES_PASSWORD=...
AUTH_SECRET=...
AUTH_COOKIE_SECURE=true
WEB_PORT=8081
```

## Site pessoal `faruk`

Ha um starter estatico em:

```text
deploy/faruk-site/index.html
```

Copie para a VPS:

```bash
mkdir -p /opt/faruk/site
cp /opt/financeiro/deploy/faruk-site/index.html /opt/faruk/site/index.html
```

Se preferir, esse site pode virar outro repositorio depois.

## Caddy central no host

Use como base o arquivo:

```text
deploy/Caddyfile.host.example
```

Conteudo esperado em `/etc/caddy/Caddyfile`:

```caddy
financeiro.faruk.dev.br {
	encode gzip zstd
	reverse_proxy 127.0.0.1:8081
}

faruk.dev.br, www.faruk.dev.br {
	encode gzip zstd
	root * /opt/faruk/site
	try_files {path} /index.html
	file_server
}
```

Depois:

```bash
sudo systemctl reload caddy
```

## Ordem sugerida

1. Atualizar DNS no Registro.br.
2. Fazer deploy do financeiro com `WEB_PORT=8081` e `AUTH_COOKIE_SECURE=true`.
3. Instalar/configurar o Caddy do host.
4. Copiar o site `faruk` para `/opt/faruk/site`.
5. Recarregar o Caddy.
6. Testar `https://financeiro.faruk.dev.br` e `https://www.faruk.dev.br`.
