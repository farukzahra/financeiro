# Plan: SALÁRIO + sort tiebreak

**Spec:** `docs/superpowers/specs/2026-07-11-categoria-salario-ordenacao-design.md`

## Files

| File | Change |
|------|--------|
| `apps/api/src/db/seed.ts` | Add SALARIO |
| `apps/api/scripts/patch-categoria-salario.ts` | Upsert category |
| `apps/web/src/lib/categories.ts` | Pill label |
| `apps/web/src/lib/transaction-sort.ts` (+ test) | Pure sort helpers |
| `apps/web/src/views/TransactionsView.vue` | Use sorted rows / multi-sort tiebreak |
| E2E | Order assertion |

## Tasks

1. Seed + datapatch + labels
2. Pure sort + unit tests (red/green)
3. Wire TransactionsView
4. E2E + run datapatch local + VPS
