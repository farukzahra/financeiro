# Plano: Usuarios, Multiusuario e Login com Google

Data: 2026-06-10

## Objetivo

Adicionar autenticacao com Google e transformar o sistema em multiusuario,
garantindo que cada usuario veja e altere apenas seus proprios dados.

## Decisao base

Criar uma tabela local de usuarios. O Google autentica a identidade, mas o
sistema mantem o usuario local, seus relacionamentos e futuras permissoes.

Modelo inicial proposto:

```text
user
- id uuid PK
- email text unique not null
- name text
- avatar_url text
- google_sub text unique not null
- created_at timestamp
- updated_at timestamp
```

`google_sub` deve ser o identificador canonico do Google, porque e mais estavel
que depender apenas do email.

## Tabelas vinculadas ao usuario

Adicionar `user_id` em:

```text
import.user_id
transaction.user_id
category.user_id
category_rule.user_id
budget_item.user_id
```

Mesmo `transaction` ja tendo `import_id`, manter `user_id` diretamente nela
facilita filtros, indices e seguranca nas queries.

## Categorias

Ha duas opcoes:

1. Categorias por usuario: cada usuario tem suas proprias categorias.
2. Categorias globais, com regras/orcamento/transacoes por usuario.

Recomendacao inicial: implementar login + `user_id` em tudo e manter categorias
globais na primeira fase se quisermos reduzir risco. Se a personalizacao de
categorias for essencial ja agora, migrar categorias para `uuid id` + `codigo`
e usar `unique(user_id, codigo)`.

Recomendacao de longo prazo: categorias por usuario, copiadas do seed inicial
quando o usuario entra pela primeira vez.

## Autenticacao

Fluxo recomendado:

1. Web mostra botao "Entrar com Google".
2. Usuario autentica no Google.
3. Backend valida a credencial/callback OAuth.
4. Backend procura `user.google_sub`.
5. Se nao existir, cria usuario local e prepara dados iniciais.
6. Backend cria sessao.
7. Frontend passa a chamar a API autenticado.

Preferencia: sessao em cookie HTTP-only assinado, em vez de token sensivel no
frontend.

Dependencias provaveis:

```text
API:
- @fastify/cookie
- @fastify/session ou JWT em cookie HTTP-only
- biblioteca/validacao OIDC do Google

Web:
- estado de sessao
- tela de login
- chamada /auth/me
```

Rotas propostas:

```text
POST /auth/google
POST /auth/logout
GET /auth/me
```

`POST /auth/google` com credential recebido do frontend tende a ser mais simples
para Vite/Electron do que callback OAuth tradicional.

## Mudancas no banco

Fase de schema:

1. Criar tabela `user`.
2. Adicionar `user_id` nas tabelas existentes.
3. Criar indices compostos:

```text
transaction(user_id, data)
transaction(user_id, categoria_id, data)
category(user_id, id) -- se categorias por usuario
category_rule(user_id, ativa, prioridade)
import(user_id, hash_sha256)
budget_item(user_id, ativo)
```

4. Ajustar unicidades conforme a decisao de categorias.

Se categorias forem por usuario, preferir:

```text
category
- id uuid PK
- user_id uuid FK
- codigo text not null
- letra text not null
- descricao text not null
- ativa boolean not null
- unique(user_id, codigo)
```

## Migracao dos dados atuais

Como ja existem dados sem usuario:

1. Criar um usuario "dono inicial".
2. Preencher `user_id` em todos os registros existentes com esse usuario.
3. Tornar `user_id NOT NULL`.
4. A partir dai, novas operacoes exigem login.

Isso preserva os dados atuais.

## Mudancas na API

Todas as rotas de dados devem obter `currentUser` da sessao e filtrar por ele:

```text
GET /transactions -> where user_id = currentUser.id
POST /imports/confirm -> grava import.user_id e transaction.user_id
GET /categories -> apenas categorias do usuario, se categorias forem por usuario
GET /rules -> apenas regras do usuario
GET /budget -> apenas orcamento do usuario
```

Tambem criar middleware/helper de autenticacao, por exemplo:

```text
requireAuth(req)
```

Rotas publicas:

```text
GET /health
POST /auth/google
```

Rotas autenticadas:

```text
GET /auth/me
POST /auth/logout
todas as rotas de imports, transactions, categories, rules e budget
```

## Mudancas no frontend

1. Criar estado de sessao:

```text
user atual
loading auth
logged in/out
```

2. Criar tela/estado de login.
3. Proteger rotas:

```text
nao autenticado -> mostra login
autenticado -> mostra app
```

4. Adicionar menu de usuario com nome/email/avatar e sair.
5. Ajustar chamadas API para lidar com `401`.

## Ordem de implementacao

1. Decidir se categorias serao globais na fase 1 ou por usuario ja agora.
2. Criar tabela `user` e rotas de auth basicas.
3. Criar sessao e `GET /auth/me`.
4. Adicionar `user_id` nas tabelas existentes com migracao segura.
5. Aplicar filtro por usuario em todas as rotas.
6. Ajustar imports e criacao manual de transacoes.
7. Ajustar frontend para login/logout/protecao de rotas.
8. Testar fluxo completo com dados antigos migrados.
9. Depois considerar permissoes/admin/multiplos perfis.

## Recomendacao final

Fazer em duas etapas:

1. Login Google + `user_id` em dados operacionais, mantendo categorias globais
   se for preciso reduzir risco.
2. Migrar categorias para por usuario quando a base estiver autenticada e
   isolada.

Se a personalizacao de categorias por usuario for requisito imediato, fazer a
migracao completa de categorias ja na primeira etapa, com mais cuidado nas FKs e
nos contratos compartilhados.

## Implementacao realizada em 2026-06-10

Foi implementada a fase 1:

- Tabela local `app_user` para usuarios autenticados via Google.
- Login Google por `POST /auth/google`, validando `credential` contra o endpoint
  `https://oauth2.googleapis.com/tokeninfo`.
- Sessao propria em cookie HTTP-only assinado por HMAC.
- Rotas `GET /auth/me` e `POST /auth/logout`.
- `user_id` em `import`, `transaction`, `category_rule` e `budget_item`.
- `transaction` passou a usar chave primaria composta `(user_id, identificador)`.
- Queries, inserts, updates e deletes de imports, transacoes, regras e orcamento
  foram filtrados por usuario autenticado.
- Categorias ficaram globais nesta fase para evitar migracao maior de FKs e
  contratos. Regras de categoria ja sao por usuario.
- Frontend ganhou tela de login com Google Identity Services, estado de sessao,
  menu com email/avatar e logout.

Variaveis necessarias:

```text
API:
GOOGLE_CLIENT_ID=<client id OAuth Web do Google>
AUTH_SECRET=<segredo longo para assinar sessoes>

Web:
VITE_GOOGLE_CLIENT_ID=<mesmo client id OAuth Web do Google>
```

Observacao: para producao, configurar tambem origem autorizada no Google Cloud e
usar `AUTH_SECRET` forte. Sem `AUTH_SECRET`, a API usa um segredo de dev, o que
nao deve ser usado fora do ambiente local.

## Revisao: trocar Google por cadastro interno

Decisao posterior: remover o login com Google e usar cadastro interno de
usuarios com email e senha.

Implementado:

- `app_user.password_hash` para senha com hash `scrypt`.
- `app_user.role` com valores iniciais `admin` e `user`.
- `POST /auth/login` para entrar com email/senha.
- `POST /auth/register` para criar conta interna.
- `GET /auth/me` e `POST /auth/logout` continuam iguais.
- Frontend passou a usar formulario interno de login/cadastro.
- Admin inicial cadastrado:

```text
email: farukz@gmail.com
senha temporaria: admin123
role: admin
```

Migration de compatibilidade: `0003_internal_auth_admin.sql`. Ela adiciona as
colunas em bancos que ja tenham recebido a migration anterior e garante o admin
inicial.

Pendencia recomendada: criar tela/endpoint de troca de senha para substituir a
senha temporaria do admin.
