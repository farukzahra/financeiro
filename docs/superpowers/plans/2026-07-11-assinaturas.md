# Assinaturas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de assinaturas em Configurações; soma sincroniza `budget_item` “Cartão de Crédito” (`origem=assinaturas`) somente leitura; seed só para `farukz@gmail.com`.

**Architecture:** Tabela `subscription` + serviço `syncCreditCardBudget(userId)` que upsert/delete o item de orçamento sistema. UI reutiliza painel de orçamento; bloqueia edit quando `origem === 'assinaturas'`.

**Tech Stack:** Drizzle/Postgres, Fastify, Zod (`@financeiro/shared`), Vue 3 + Vuetify, Vitest, Playwright.

## Global Constraints

- UUID PK em toda tabela nova.
- CRUD só como aba em Configurações.
- Money como string decimal nos contratos.
- Seed apenas `farukz@gmail.com`; novos users sem assinaturas; bootstrap não copia item `origem=assinaturas`.
- E2E com mocks; unitários sem banco real (domínio puro extraído).
- Testes: `pnpm test` antes de concluir.

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/src/db/schema.ts` + migration | `subscription`, `budget_item.origem` |
| `packages/shared/src/index.ts` | Zod subscription + `origem` em budget |
| `apps/api/src/services/credit-card-budget.ts` | soma + decisão sync (puro) + `syncCreditCardBudget` |
| `apps/api/src/routes/subscriptions.ts` | CRUD + sync |
| `apps/api/src/routes/budget.ts` | 403 em item sistema |
| `apps/api/src/services/admin-bootstrap.ts` | skip origem assinaturas |
| `apps/api/src/db/seed.ts` | 7 assinaturas Faruk + sync |
| `apps/web/src/lib/api.ts` | client |
| `apps/web/src/views/SettingsView.vue` | aba Assinaturas + lock orçamento |
| `apps/web/src/views/TransactionsView.vue` | bloquear inline edit |
| `apps/web/e2e/*` | mocks + specs |

---

### Task 1: Shared Zod + domain puro + testes unitários

**Files:**
- Modify: `packages/shared/src/index.ts`
- Create: `apps/api/src/services/credit-card-budget.ts`
- Create: `apps/api/src/services/credit-card-budget.test.ts`

- [ ] **Step 1:** Add to shared:

```ts
export const BUDGET_ORIGEM_ASSINATURAS = "assinaturas" as const;

// BudgetItemSchema + create: add
origem: z.enum(["assinaturas"]).nullable().optional(),

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1),
  valorMensal: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  criadoEm: z.string(),
});
export const SubscriptionCreateSchema = z.object({
  nome: z.string().min(1),
  valorMensal: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
});
export const SubscriptionUpdateSchema = SubscriptionCreateSchema.partial();
```

- [ ] **Step 2:** Domain helpers + tests for `sumMonthlyValues`, `creditCardBudgetAction`, constants `CREDIT_CARD_BUDGET_DESCRICAO`, `isSystemBudgetItem(origem)`.

- [ ] **Step 3:** Run `pnpm --filter @financeiro/api test` — domain tests pass (sync DB part later).

---

### Task 2: Schema + migration

- [ ] Add `subscriptions` table + `origem` on `budgetItems` in `schema.ts`.
- [ ] `pnpm db:generate` && `pnpm db:migrate`.

---

### Task 3: Sync service + routes

- [ ] Implement `syncCreditCardBudget(userId)` using Drizzle.
- [ ] `registerSubscriptionRoutes`; guard budget PATCH/DELETE/POST.
- [ ] Update `admin-bootstrap` to skip `origem === 'assinaturas'`.
- [ ] Seed Faruk subscriptions + sync.
- [ ] Register routes in `index.ts`.

---

### Task 4: Web client + Settings + Transactions UI

- [ ] API client types/functions.
- [ ] Settings tab Assinaturas (CRUD + total).
- [ ] Lock budget actions for system item.
- [ ] Transactions panel: no inline edit when `origem === 'assinaturas'`.

---

### Task 5: E2E + verify

- [ ] Mock `/subscriptions` + `origem` on budget; specs settings-subscriptions + budget lock in panel.
- [ ] Update e2e-bugfixes coverage table.
- [ ] `pnpm test`.

---
