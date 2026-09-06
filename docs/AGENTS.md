# AGENTS.md

Guia rapido para agentes trabalhando neste repositorio. A ideia deste arquivo e
guardar o contexto que normalmente se perde entre sessoes: o que o projeto faz,
como ele roda, onde ficam as decisoes importantes e quais cuidados tomar antes
de editar.

## Resumo do projeto

Este e um sistema financeiro pessoal para importar extratos CSV do Nubank,
normalizar transacoes, sugerir categorias, permitir revisao manual e persistir
o resultado em PostgreSQL. A tela principal lista transacoes, filtros, resumo de
entradas/saidas/saldo, edicao de categoria/observacao e cadastro de orcamento
previsto.

O fluxo central e:

1. O usuario envia um CSV Nubank em `POST /imports/preview`.
2. A API extrai metadados do nome do arquivo, calcula hash, parseia linhas,
   normaliza descricoes e sugere categorias.
3. A UI mostra um preview para o usuario confirmar ou ajustar.
4. O usuario confirma em `POST /imports/confirm`.
5. A API cria um registro de importacao e insere transacoes com deduplicacao
   por `identificador` do Nubank.

## Stack e estrutura

- Monorepo `pnpm` com workspaces em `apps/*` e `packages/*`.
- `apps/api`: API Fastify + TypeScript + Drizzle ORM + PostgreSQL.
- `apps/web`: Vue 3 + Vite + TypeScript + Vuetify + Pinia.
- `packages/shared`: schemas Zod e tipos compartilhados entre API e web.
- Scripts Python em `scripts/legacy/` sao legado/apoio da logica de
  categorizacao.
- Agent skills em `.agents/skills/`; comando `/commit-push` em
  `.cursor/commands/commit-push.md`.

### Skills do projeto

Skills em `.agents/skills/`; lock em `skills-lock.json`. Workflow **Superpowers**
(`obra/superpowers`): manter atualizado com `pnpm skills:update` (ou `npx skills check`).

| Skill | Fonte | Quando usar |
|-------|-------|-------------|
| `using-superpowers` | superpowers | Inicio de sessao — como achar e usar skills |
| `brainstorming` | superpowers | Feature/UI nova — antes de codigo |
| `writing-plans` | superpowers | Apos design aprovado |
| `test-driven-development` | superpowers | Implementacao com testes (antes do codigo) |
| `executing-plans` | superpowers | Executar plano em sessao separada |
| `subagent-driven-development` | superpowers | Executar plano na sessao atual |
| `using-git-worktrees` | superpowers | Isolar feature em worktree |
| `systematic-debugging` | superpowers | Bug / teste falhando |
| `verification-before-completion` | superpowers | Antes de declarar pronto |
| `vue-best-practices` | hyf0/vue-skills | Qualquer trabalho Vue |
| `vuetify-ui` | local | Telas, tabelas, dialogs Vuetify |
| `frontend-design` | anthropics/skills | Mudanca forte de identidade visual |
| `fastify-api` | local | Rotas/auth/contratos da API |
| `drizzle-orm` | local | Schema, migrations, queries |
| `nodejs-backend-patterns` | wshobson/agents | Padroes de services (opcional) |
| `playwright-best-practices` | currents-dev | E2E |
| `caveman-commit` | juliusbrussee/caveman | Mensagens de commit |
| `semantic-version` | local | Bump em `docs/release-history.json` (so no `/commit-push`) |
| `find-skills` | vercel-labs/skills | Buscar skills externas |

Nao usar skills Prisma / React Next / mattpocock neste repo.

Arquivos importantes:

- `package.json`: scripts do monorepo.
- `docker-compose.yml`: Postgres opcional via Docker (alternativa ao Postgres externo).
- `apps/api/src/index.ts`: bootstrap da API e registro das rotas.
- `apps/api/src/db/schema.ts`: modelo Drizzle.
- `apps/api/src/db/migrations/`: migrations versionadas.
- `apps/api/src/services/parser.ts`: parsing do CSV Nubank.
- `apps/api/src/services/normalize.ts`: split/normalizacao/chave de agrupamento.
- `apps/api/src/services/categorizer.ts`: cascata de categorizacao.
- `apps/web/src/lib/api.ts`: cliente HTTP e tipos usados pela UI.
- `apps/web/src/views/TransactionsView.vue`: tela principal.
- `apps/web/src/views/SettingsView.vue`: categorias/regras/configuracoes.
- `docs/AGENTS.md`: guia operacional para agentes neste repositorio.
- `docs/PLANO_SISTEMA.md`: desenho original do dominio e fluxo.
- `docs/vps-multisite-faruk.md`: guia de VPS com `faruk.dev.br`,
  `www.faruk.dev.br` e `financeiro.faruk.dev.br`.
- `docs/parser-categorizacao-nubank.md`: desenho do parser e categorizacao
  deterministica dos extratos Nubank.
- `planos/`: planos novos solicitados pelo usuario, um arquivo Markdown por
  plano.

Autenticacao/multiusuario:

- Usuarios ficam em `app_user`.
- Login interno usa `POST /auth/login`, `POST /auth/register`, `GET /auth/me` e
  `POST /auth/logout`.
- A sessao e um cookie HTTP-only assinado pela API.
- Configure `AUTH_SECRET` na API em ambientes reais.
- Senhas usam hash `scrypt` em `app_user.password_hash`.
- `app_user.role` define papeis simples; `farukz@gmail.com` e o admin inicial.
  Mantenha apenas um usuario com `role = admin` no banco.
- No cadastro (`POST /auth/register`), se existir admin, o novo usuario recebe
  copia dinamica das regras, itens de orcamento e preferencias (`settings`) do
  admin. Categorias sao globais e ja ficam disponiveis para todos. Sem admin,
  o cadastro segue sem bootstrap.
- Preferencias persistentes do usuario ficam em `app_user.settings` como JSONB.
  Hoje a tela inicial salva/restaura `transactionsFilters` com periodo,
  categorias, busca e painel lateral ativo.
- `import`, `transaction`, `category_rule` e `budget_item` sao escopados por
  `user_id`.
- Categorias continuam globais na fase atual; regras de categorizacao sao por
  usuario.
- `transaction` usa PK composta `(user_id, identificador)` para permitir o mesmo
  identificador Nubank em usuarios diferentes.

## Planos

Quando o usuario pedir um plano, crie sempre um arquivo `.md` dentro de
`planos/`, alem de responder na conversa. Use nomes no formato:

```text
YYYY-MM-DD-slug-curto.md
```

O plano deve registrar objetivo, decisoes, etapas, riscos/cuidados e ordem de
implementacao. Se o plano evoluir depois, atualize o mesmo arquivo quando for o
mesmo assunto; crie um arquivo novo quando for um plano diferente.

## Organizacao de Markdown

Nao crie arquivos `.md` na raiz do repositorio, com excecao de `README.md`.
Use sempre uma pasta adequada:

- `docs/`: documentacao tecnica, guias operacionais, notas de arquitetura e
  contexto duradouro.
- `planos/`: planos de implementacao ou investigacao pedidos pelo usuario.
- `.github/`: instrucoes especificas para GitHub/Copilot/Actions.

Se um Markdown antigo aparecer na raiz, mova para `docs/` ou `planos/` com nome
descritivo em kebab-case antes de editar.

## Organizacao de dados locais

Nao crie CSVs, dumps SQL, planilhas ou saidas geradas na raiz do repositorio.
Use sempre `dados/`:

- `dados/csv/`: CSVs auxiliares versionados, como
  `merchants_para_classificar.csv`.
- `dados/output/`: saidas locais geradas por scripts legados.
- `dados/sheets/`: arquivos auxiliares de planilhas.
- `dados/exports/`: dumps/exportacoes locais, normalmente ignorados pelo Git.

`exemplo_input/` continua reservado para CSVs de exemplo do Nubank usados em
testes manuais.

## Como rodar

Instalar dependencias:

```powershell
pnpm install
```

Configurar banco local (Postgres externo, fora do Docker):

```powershell
copy apps\api\.env.example apps\api\.env
pnpm db:migrate
pnpm db:seed
```

Padrao: `postgres://postgres:postgres@localhost:5432/financeiro` em
`apps/api/.env`. Ajuste `DATABASE_URL` se suas credenciais forem diferentes.

Rodar API e web:

```powershell
pnpm dev
```

Em dev local, a API le `DATABASE_URL` de `apps/api/.env`. O
`docker-compose.yml` (porta `5433`) e alternativa opcional; o padrao do projeto
e o Postgres externo na porta `5432`.

## Scripts uteis

- `pnpm dev`: roda todos os workspaces com script `dev` em paralelo.
- `pnpm build`: build de todos os workspaces.
- `pnpm db:up`: sobe Postgres via Docker Compose (opcional; dev local usa Postgres externo).
- `pnpm db:down`: derruba os servicos do Compose.
- `pnpm db:generate`: gera migration Drizzle a partir do schema.
- `pnpm db:migrate`: aplica migrations.
- `pnpm db:seed`: cadastra categorias iniciais.
- `.\scripts\windows\categorizar.bat <arquivo.csv>`: fluxo Python legado para categorizar CSV.

## Modelo de dominio

Tabelas principais:

- `category`: categorias canonicas (`ALIMENTACAO`, `PIX`, `OUTROS`, etc.).
- `category_rule`: regras do usuario por substring ou regex, com prioridade.
- `import`: uma importacao confirmada de arquivo CSV.
- `transaction`: linha persistida do extrato, com PK `identificador`.
- `budget_item`: itens de orcamento previsto mensal (item com `origem = assinaturas`
  e espelho somente-leitura da soma de `subscription`).
- `subscription`: assinaturas mensais por usuario; seed so para `farukz@gmail.com`.

Decisoes importantes:

- `transaction.identificador` e a chave primaria e vem do Nubank.
- Preview nao persiste nada; so `confirm` grava.
- Importacoes duplicadas sao detectadas por `hashSha256`, mas a deduplicacao
  real das transacoes acontece por PK com `onConflictDoNothing`.
- Valores monetarios trafegam como string decimal para preservar precisao.
- Edicao manual de categoria limpa `categoryRuleId` e marca `regraAplicada`
  como `manual`.

## Categorizacao

A cascata em `apps/api/src/services/categorizer.ts` e:

1. Regras ativas de `category_rule`, ordenadas por menor `prioridade`.
2. Tipos automaticos em `TIPOS_AUTOMATICOS` (`normalize.ts`), como Pix.
3. Heuristicas embutidas em `HEURISTICS`.
4. Fallback para `OUTROS`.

A chave de agrupamento vem de `chaveAgrupamento(tipo, detalhe)`. Para Pix e
transferencias, a chave tende a ser o nome extraido do detalhe; para outros
tipos, usa detalhe normalizado.

## API

Rotas registradas em `apps/api/src/index.ts`:

- `GET /health`
- `POST /imports/preview`
- `POST /imports/confirm`
- `GET /transactions`
- `POST /transactions`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`
- `GET /transactions/tipos`
- `GET /transactions/summary`
- `GET /categories`
- `POST /categories`
- `PATCH /categories/:id`
- `GET /rules`
- `POST /rules`
- `PATCH /rules/:id`
- `GET /rules/preview`
- `GET /budget`
- `POST /budget`
- `PATCH /budget/:id`
- `DELETE /budget/:id`
- `GET /subscriptions`
- `POST /subscriptions`
- `PATCH /subscriptions/:id`
- `DELETE /subscriptions/:id`

Use os schemas de `packages/shared/src/index.ts` para validar contratos. Ao
adicionar endpoints ou alterar payloads, atualize `packages/shared` e o cliente
em `apps/web/src/lib/api.ts`.

## Banco e migrations

Regra: mudancas em `apps/api/src/db/schema.ts` precisam de migration Drizzle
commitada junto.

Se uma mudanca remover coluna, tabela ou dado persistido, documente isso no
proprio trabalho e garanta que a migration correspondente seja aplicada tambem
em producao durante o deploy. Build aprovado nao substitui migration executada
na VPS.

Fluxo recomendado:

```powershell
pnpm db:generate
pnpm db:migrate
```

Depois revise o SQL gerado em `apps/api/src/db/migrations/`. Nao edite
migrations antigas ja aplicadas; crie uma nova migration corretiva.

## Frontend

A web usa Vue SFCs e Vuetify 3. O proxy do Vite envia `/api` para
`http://localhost:3001` e remove o prefixo antes de chegar na API.

Pontos de orientacao:

- `router.ts` tem rotas: `/`, `/configuracoes`, `/sobre`.
- `TransactionsView.vue` concentra a experiencia principal.
- `ImportModal.vue` cuida do upload/preview/confirmacao.
- `ManualTransactionModal.vue` cria lancamentos manuais.
- `SettingsView.vue` gerencia categorias, regras e orcamento.
- `AboutView.vue` mostra a versao do build e o historico a partir de
  `docs/release-history.json` (skill `semantic-version`).
- `stores/reference.ts` centraliza dados de referencia, como categorias.
- `styles.css` contem estilo global; mantenha UI consistente com Vuetify.

Ao fazer um novo commit que altere o produto visivel ao usuario (via
`/commit-push`):

- aplique a skill `semantic-version` em `docs/release-history.json`
  (`title`/`summary` em portugues);
- alinhe `package.json` da raiz e dos workspaces com `currentVersion`;
- nao hardcode historico em `AboutView.vue`;
- rode `pnpm release:check` (o hook pre-commit tambem valida).

Ao mudar a API, ajuste tambem `apps/web/src/lib/api.ts` e os tipos locais.

## Encoding e CSV

Ha textos com mojibake em alguns arquivos, especialmente em nomes de operacoes
com acentos e no header de descricao do CSV. Isso afeta parsing de CSV e labels
de tipos Nubank. Antes de "corrigir" acentos, verifique se o CSV real e os
testes manuais continuam batendo. Uma correcao parcial de encoding pode quebrar
importacoes existentes.

Para texto visivel na interface web, prefira sempre portugues com acentuacao
correta. Nao introduza labels sem acento por conveniencia ("orcamento",
"configuracoes", "liquido", "transacao", "mes", "util") quando o texto
exibido ao usuario puder ser "orçamento", "configurações", "líquido",
"transação", "mês" e "útil". A cautela com encoding vale principalmente
para parsing, CSV legado e strings historicas sensiveis.

O parser espera nomes de arquivo no padrao:

```text
NU_<conta>_<DDMMMYYYY>_<DDMMMYYYY>.csv
```

Exemplo:

```text
NU_941505780_01JUN2026_07JUN2026.csv
```

## Padroes para alteracoes

- Leia o fluxo existente antes de editar; este projeto tem logica de dominio
  espalhada entre parser, normalizacao, categorizador e UI.
- Preserve valores monetarios como string decimal nos contratos.
- Para transacoes, mantenha `identificador` como id canonico.
- Nao grave preview no banco.
- Ao adicionar campo persistido, atualize: schema Drizzle, migration, schemas
  Zod, rotas, cliente web e UI.
- Ao mexer em categoria/regra, pense no impacto sobre imports futuros e sobre
  historico ja classificado.
- Prefira reutilizar schemas de `packages/shared` em vez de duplicar validacao.
- Evite refactors grandes misturados com mudanca funcional.
- Se encontrar worktree suja, nao reverta mudancas de outros.

## Git

Quando o usuario pedir para commitar:

1. Crie o commit com mensagem no padrao **Conventional Commits** (em ingles).
2. Faca **`git push`** em seguida para publicar na branch remota.

Nao pare no commit local — o push faz parte do fluxo esperado. O deploy da VPS
dispara automaticamente via GitHub Actions ao receber push em `main`/`master`.

So faca push quando o usuario pedir commit (ou push explicitamente). Nunca use
comandos destrutivos (`push --force`, `reset --hard`) sem pedido claro.

## Verificacao recomendada

Antes de entregar mudancas, rode na raiz:

```powershell
pnpm test
```

Isso executa testes unitarios da API (Vitest) e E2E da web (Playwright). O `pnpm build` tambem roda `pnpm test` automaticamente antes de compilar.

Comandos individuais:

```powershell
pnpm --filter @financeiro/api test
pnpm test:e2e
pnpm build
```

Fluxo manual minimo para importacao:

1. Abrir a UI.
2. Importar um CSV de `exemplo_input/`.
3. Verificar preview, categorias sugeridas e duplicadas.
4. Confirmar importacao.
5. Conferir lista de transacoes, resumo e filtros.

## Observacoes para agentes futuros

- Este arquivo deve ser atualizado quando arquitetura, comandos, portas,
  contratos ou fluxo de dados mudarem.
- `docs/PLANO_SISTEMA.md` e util como contexto historico, mas o codigo atual e
  a fonte da verdade.
