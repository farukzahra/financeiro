# Assinaturas → Orçamento “Cartão de Crédito”

**Date:** 2026-07-11  
**Status:** Approved for implementation planning

## Problem

O usuário precisa gerenciar assinaturas mensais (serviços recorrentes) e ver o impacto no orçamento como uma linha única **Cartão de Crédito**, cujo valor é a soma das assinaturas. Hoje só existe `budget_item` genérico, sem conceito de assinatura nem item de sistema.

## Goals

- CRUD de assinaturas (nome + valor) como aba em **Configurações**.
- Soma das assinaturas mantém um `budget_item` sistema “Cartão de Crédito” (`origem = assinaturas`), somente leitura.
- Esse item participa do painel Orçamento na tela de Transações como os demais (lista, totais, ordem), sem edição de valor.
- Seed inicial das 7 assinaturas apenas para `farukz@gmail.com` (dev e prod); novos usuários começam vazios.

## Non-goals

- Categoria / dia de vencimento em assinatura.
- Cópia de assinaturas (ou do item cartão) no registro de novos usuários.
- Matching automático de gastos de cartão por categoria (item cartão fica com `categoriaId = null` por enquanto).
- Rota dedicada `/assinaturas` (CRUD só em Configurações).

## Architecture

```
subscription (CRUD)
       │
       ▼
syncCreditCardBudget(userId)
       │
       ▼
budget_item { descricao: "Cartão de Crédito", origem: "assinaturas", valorMensal: SUM }
       │
       ▼
Painel Orçamento (Transações) + aba Orçamento (Configurações, read-only para esse item)
```

Fonte da verdade do valor: tabela `subscription`. O `budget_item` é espelho sincronizado para reutilizar o fluxo de orçamento sem special-cases pesados na UI.

## Data model

### Table `subscription`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK `defaultRandom()` | |
| `user_id` | uuid NOT NULL → `app_user.id` | |
| `nome` | text NOT NULL | serviço |
| `valor_mensal` | numeric(14,2) NOT NULL | |
| `criado_em` | timestamptz default now | |

Indexes: `(user_id)`; **UNIQUE** `(user_id, nome)` para seed idempotente e evitar duplicata de serviço.

### Change on `budget_item`

| Column | Type | Notes |
|--------|------|--------|
| `origem` | text NULL | `null` = item normal; `'assinaturas'` = item sistema Cartão de Crédito |

Constraints de negócio (código, não necessariamente DB):
- No máximo um `budget_item` por usuário com `origem = 'assinaturas'`.
- Item sistema: `descricao = "Cartão de Crédito"`, `categoriaId = null`, `diaVencimento = null`, `ativo = true` enquanto a soma > 0.

## Sync rules

`syncCreditCardBudget(userId)`:

1. `sum = SUM(valor_mensal)` das assinaturas do usuário.
2. Se `sum > 0`: upsert do item `origem = 'assinaturas'` com `valorMensal = sum` (formatado com 2 casas).
3. Se `sum === 0`: delete do item `origem = 'assinaturas'` (se existir).

Chamada após: POST/PATCH/DELETE de assinatura e após o seed do Faruk.

## API

Auth: cookie sessão (`requireUser`), escopo por `user_id`.

### Subscriptions `/subscriptions`

| Method | Path | Body | Behavior |
|--------|------|------|----------|
| GET | `/subscriptions` | — | Lista do usuário, order by `nome` |
| POST | `/subscriptions` | `{ nome, valorMensal }` | Cria + sync |
| PATCH | `/subscriptions/:id` | partial `{ nome?, valorMensal? }` | Atualiza + sync; 404 se não for do user |
| DELETE | `/subscriptions/:id` | — | Remove + sync; 404 se não for do user |

Zod em `packages/shared` (espelhar padrão de budget).

### Budget adjustments

- `PATCH` / `DELETE` em item com `origem === 'assinaturas'` → **403**.
- `POST /budget` não aceita `origem: 'assinaturas'` (campo omitido no create schema do cliente; se enviado, rejeitar).
- `GET /budget` inclui o item cartão com `origem` no payload.

### Register / admin bootstrap

- **Não** copiar linhas de `subscription`.
- Ao copiar `budget_item` do admin, **pular** itens com `origem === 'assinaturas'`.

## UI

### Configurações — aba Assinaturas

- Tabela: Serviço | Valor | ações (editar / excluir).
- Dialog: nome + valor.
- Total no header.
- Sem paginação (`items-per-page="-1"`).

### Configurações — aba Orçamento

- Item `origem === 'assinaturas'` listado; ações editar/excluir desabilitadas (tooltip).

### Transações — painel Orçamento

- Item cartão entra em lista, totais e `budgetOrder`.
- Inline edit de valor bloqueado.
- Drag de ordem permitido.

Convenção do projeto: todo CRUD de entidade fica como aba em Configurações (ver `.cursor/rules/crud-in-settings.mdc`).

## Seed

Usuário alvo: `farukz@gmail.com` apenas.

| Serviço | Valor |
|---------|-------|
| Cursor AI Powered IDE | 110.53 |
| Contabilizei | 195.00 |
| Internet | 159.90 |
| YouTube Premium | 53.90 |
| Google One | 9.99 |
| Celular Faruk | 45.00 |
| VPS | 31.72 |

Soma esperada do item Cartão de Crédito: **606.04**.

Idempotente: re-rodar seed não duplica (match por `user_id` + `nome`). Em seguida `syncCreditCardBudget`.

## Testing

### Unit (API Vitest)

- `syncCreditCardBudget`: cria item quando há assinaturas; atualiza valor; remove quando soma zero.
- Rotas budget: PATCH/DELETE do item sistema → 403.
- (Opcional) POST subscription dispara sync com soma correta — preferir testar a função de sync isolada com DB mock/in-memory se o projeto já tiver padrão; senão testes puros da função de soma + regras se extrair domínio puro.

### E2E (Playwright, mocks)

- Aba Assinaturas: criar item, ver total, editar, excluir.
- Painel orçamento: mock de budget com item `origem: assinaturas` — valor visível, edit inline não aplicado / controle desabilitado.
- Mocks em `e2e/fixtures/mock-api.ts` para `/subscriptions`.

## File touchpoints (expected)

- `apps/api/src/db/schema.ts` + migration
- `apps/api/src/routes/subscriptions.ts` (+ register in `index.ts`)
- `apps/api/src/services/sync-credit-card-budget.ts` (nome aproximado)
- `apps/api/src/routes/budget.ts` (guards origem)
- `apps/api/src/services/admin-bootstrap.ts` (skip item assinaturas)
- `apps/api/src/db/seed.ts` (assinaturas Faruk + sync)
- `packages/shared/src/index.ts` (Zod + `origem` em BudgetItem)
- `apps/web/src/lib/api.ts`
- `apps/web/src/views/SettingsView.vue`
- `apps/web/src/views/TransactionsView.vue`
- `apps/web/e2e/` + `mock-api.ts`

## Decisions log

| Decision | Choice | Why |
|----------|--------|-----|
| Espelho do cartão | `budget_item` real sync | Comportamento igual ao painel sem proliferar `if (cartao)` |
| Campos assinatura | só nome + valor | Pedido explícito |
| Seed | só `farukz@gmail.com` | Novos users vazios |
| Categoria do cartão | `null` | Progresso por categoria fica para depois |
| CRUD location | aba Configurações | Convenção do projeto |
