# Plano: Categorias com UUID, código editável e categorização menos hardcoded

**Contexto:** o cadastro de categorias usava o texto canônico (`ALIMENTACAO`, `PIX`, …) como
PK. Isso impedia renomear o código sem quebrar FKs em `transaction`, `category_rule` e
`budget_item`, e misturava identificador técnico com rótulo de negócio.

**Decisão arquitetural (2026-07-07):** seguir o padrão das demais tabelas do projeto —
**PK `id` UUID** + coluna **`code` (text, unique)** para o identificador legível/canonico.
FKs passam a referenciar `category.id` (uuid). Regra permanente: toda tabela nova usa UUID
como PK, inclusive junções N:N (ver `.cursor/rules/uuid-primary-keys.mdc`).

**Migration:** `0006_category_uuid_pk.sql` — renomeia `category.id` → `code`, adiciona
`category.id` uuid, migra `categoria_id` em transações/regras/orçamento.

**Objetivo restante:** permitir editar `code` com segurança, reduzir hardcode no
categorizador e usar `descricao` do banco como label principal na UI.

---

## Estado atual (pós-migration 0006)

### Banco e API

| Tabela / coluna | Papel |
|-----------------|-------|
| `category.id` | PK uuid (`gen_random_uuid()`) |
| `category.code` | Código canônico unique (`ALIMENTACAO`, `PIX`, …) — ex-PK |
| `category.descricao` | Nome exibido nas telas |
| `transaction.categoria_id` | FK uuid → `category.id` |
| `category_rule.categoria_id` | FK uuid → `category.id` |
| `budget_item.categoria_id` | FK uuid opcional → `category.id` |
| `POST /categories` | body: `{ code, descricao, ativa? }` |
| `PATCH /categories/:id` | `:id` = uuid; body: `{ code?, descricao?, ativa? }` |

### Camada de resolução

`apps/api/src/services/category-lookup.ts` — `indexCategories()` resolve **code ou uuid**
para gravação; o categorizador continua trabalhando com **codes** internamente e a API
converte na borda (import confirm, PATCH transação).

### UI

| Local | Comportamento |
|-------|---------------|
| `SettingsView.vue` | Campo **Código** na criação; desabilitado na edição (por ora) |
| Combos | `value` = `category.id` (uuid) |
| `categories.ts` | `categoryDisplayName(id, catalog)` prioriza `descricao` do banco |
| Import | preview usa `categoriaSugerida` (code); confirm envia uuid |

### Categorização automática (ordem de prioridade)

1. **Regras do usuário** (`category_rule`) — dinâmico ✅ (FK uuid; lite usa `code` no categorizer)
2. **Tipos automáticos** (`TIPOS_AUTOMATICOS`) — hardcoded → code `"PIX"`
3. **Heurísticas** (`HEURISTICS`) — hardcoded → codes (`ALIMENTACAO`, …)
4. **Fallback** — hardcoded → code `"OUTROS"`

---

## Problema que o usuário quer resolver

Cenários reais levantados na conversa:

- Renomear conceito de categoria (ex.: separar `SAUDE` de `UNIMED`, refinar `ALIMENTACAO`)
- Criar categorias novas e querer que apareçam com nome bonito sem editar código
- Dúvida se faz sentido editar o **ID** ou só a **descrição**

---

## Decisões a tomar

### 1. Código (`code`) editável ou só descrição?

| Opção | Prós | Contras |
|-------|------|---------|
| **A — `code` imutável após criação** (atual) | FKs uuid estáveis; código vira contrato do categorizador | Renomear slug exige endpoint dedicado |
| **B — Permitir renomear `code`** com atualização em cascata nas regras/heurísticas | Um lugar para “renomear de verdade” | Heurísticas hardcoded ainda usam codes fixos no TS |
| **C — Só editar `descricao`** | Já funciona; uuid nunca muda | Código técnico (`ALIMENTACAO`) permanece na pill |

> **Sugestão pós-UUID:** **Opção C** para o dia a dia; **Opção B** como endpoint
> `PATCH /categories/:uuid/rename-code` quando realmente precisar mudar o slug (sem
> tocar no uuid). A PK uuid elimina a necessidade de cascade em transações ao renomear code.

### 2. O que fazer com heurísticas hardcoded?

| Opção | Descrição |
|-------|-----------|
| **A — Mover para o banco** | Tabela `category_heuristic` (categoria_id + keywords) ou ampliar `category_rule` com flag `sistema` |
| **B — Manter no código** | Documentar que IDs canônicos do seed são contrato do categorizador |
| **C — Híbrido** | Heurísticas padrão no seed como regras globais do admin; usuário pode sobrescrever com regras próprias |

> **Sugestão:** **Opção C** — na prática, importar `HEURISTICS` e `TIPOS_AUTOMATICOS`
> como regras seed do admin (prioridade alta, `ativa` editável). Remove hardcode do
> TypeScript sem perder comportamento atual. Fallback `OUTROS` permanece no código ou vira
> setting do admin.

### 3. Labels de exibição (`CATEGORY_LABELS`)

| Opção | Descrição |
|-------|-----------|
| **A — Usar só `category.descricao`** | Remove `CATEGORY_LABELS`; fonte única no banco |
| **B — Manter mapa como override de acento** | Duplicação; difícil de manter |

> **Sugestão:** **Opção A** — `categoryDisplayName(c)` retorna `c.descricao` (ou `c.id` se
> vazio). Garantir que seed e cadastro salvem descrição com acentuação correta.

### 4. Fallback `OUTROS`

- Manter categoria `OUTROS` como obrigatória no sistema (não permitir excluir/desativar
  se houver transações sem outra categoria default)
- Alternativa: `app_user.settings.defaultCategoryId` por usuário — mais flexível, mais
  complexo

> **Sugestão:** manter `OUTROS` global por enquanto.

---

## Proposta de implementação

### Fase 0 — UUID PK em `category` ✅ (feito)

1. Migration `0006_category_uuid_pk.sql`
2. Schema Drizzle: `id uuid`, `code text unique`
3. FKs em transaction / category_rule / budget_item → uuid
4. API + shared + frontend + E2E atualizados
5. `category-lookup.ts` na borda import/transações

### Fase 1 — Quick wins (baixo risco)

**Objetivo:** melhorar cadastro sem mexer em PK.

1. **Frontend:** usar `category.descricao` como label principal em todos os combos e pills
   - Alterar `categoryOptionLabel` / `categoryDisplayName` para priorizar `descricao` do banco
   - Deprecar `CATEGORY_LABELS` (remover após validar telas)
2. **Seed:** revisar descrições com acentuação (`Alimentação`, `Farmácia`, …)
3. **UI cadastro:** deixar claro na dialog que ID é identificador técnico imutável e
   descrição é o nome exibido
4. **Docs:** nota em `AboutView` / AGENTS sobre ID vs descrição

**Arquivos prováveis:** `apps/web/src/lib/categories.ts`, `SettingsView.vue`, `seed.ts`

**Testes:** E2E em configurações — criar categoria nova, ver label na lista de transações

---

### Fase 2 — Renomear `code` com segurança (médio risco)

**Objetivo:** permitir alterar `category.code` sem mexer no uuid (transações intactas).

1. **API:** `PATCH /categories/:id` já aceita `code` — validar unicidade e bloquear renomear `OUTROS`
2. **UI:** habilitar campo código na edição com confirmação
3. **Opcional:** `GET /categories/:id/usage` (contagem de regras/orçamento)

Cascade em transações ao renomear PK — **obsoleto** após Fase 0 (uuid estável).

**Testes:** E2E editando código; backend valida unicidade

---

### Fase 3 — Heurísticas dinâmicas (médio/alto esforço)

**Objetivo:** tirar IDs do `categorizer.ts` sem perder sugestões na importação.

1. **Modelo:** reutilizar `category_rule` com coluna `escopo` (`user` | `system`) **ou**
   tabela `system_category_rule` só do admin
2. **Seed/migration:** converter `HEURISTICS` e `TIPOS_AUTOMATICOS` em regras seed
3. **Categorizer:** remover arrays hardcoded; cascata = regras system + regras user (por
   prioridade) → fallback `OUTROS`
4. **Admin UI (futuro):** editar regras system só para `role = admin`
5. **Bootstrap:** novos usuários já copiam regras do admin (fluxo existente) — validar se
   regras system devem ser copiadas ou sempre lidas globalmente

**Arquivos prováveis:** `categorizer.ts`, `normalize.ts`, `seed.ts`, possivelmente `schema.ts`,
`SettingsView.vue` ou tela admin

**Testes:** unitários do categorizer com regras mock; import preview E2E

---

## Riscos e cuidados

| Risco | Mitigação |
|-------|-----------|
| Rename de ID em produção com muitas transações | Endpoint transacional + preview de impacto |
| Heurística apontando para ID inexistente | Validar FK ao salvar regra; seed idempotente |
| Usuário desativa categoria usada em regras | Aviso na UI; regras continuam mas combo filtra `ativa` |
| Remover `CATEGORY_LABELS` muda textos na UI | Conferir seed/descrições antes do deploy |
| Regras system vs user duplicadas | Prioridade clara: user override > system > fallback |
| Deploy sem migration | Seguir regra do projeto: migration commitada + aplicada na VPS |

---

## Ordem sugerida

1. **Fase 1** — labels do banco, UX do cadastro (1 PR pequeno)
2. **Fase 2** — editar `code` com confirmação (1 PR)
3. **Fase 3** — heurísticas no banco (1–2 PRs)

Fase 0 (UUID) já desacopla histórico de transações do slug. Fase 1 melhora exibição.
Fase 2 permite renomear código sem migration de FK. Fase 3 elimina hardcode do categorizer.

---

## Critérios de aceite

- [x] `category` com PK uuid e `code` unique (migration 0006)
- [x] FKs de transação/regra/orçamento usam uuid
- [ ] Nova categoria criada pelo usuário aparece com `descricao` correta em todas as telas
- [ ] Edição de categoria altera `descricao` e `ativa` sem confusão com código/uuid
- [ ] (Fase 2) Renomear `code` sem alterar uuid nem transações
- [ ] (Fase 3) Import preview usa regras do banco, não arrays em TypeScript
- [ ] (Fase 3) Comportamento atual de seed (ALIMENTACAO, PIX, OUTROS) preservado após migrate
- [ ] Testes automatizados cobrindo rename e categorização

---

## Fora de escopo (por ora)

- Excluir categoria com referências (merge para outra categoria)
- Categorias por usuário (hoje são globais)
- Hierarquia pai/filho de categorias
- Sincronizar com planilha ou ERP externo

---

## Referências no código

| Arquivo | Papel |
|---------|-------|
| `apps/web/src/views/SettingsView.vue` | Cadastro; ID disabled na edição |
| `apps/web/src/lib/categories.ts` | Labels hardcoded |
| `apps/api/src/db/schema.ts` | PK e FKs |
| `apps/api/src/routes/categories.ts` | CRUD atual |
| `apps/api/src/services/categorizer.ts` | Heurísticas e fallback |
| `apps/api/src/services/normalize.ts` | `TIPOS_AUTOMATICOS` |
| `apps/api/src/db/seed.ts` | Categorias iniciais |
| `planos/2026-06-15-categorias-orcamento.md` | Caso de uso Unimed / 1:1 orçamento |
