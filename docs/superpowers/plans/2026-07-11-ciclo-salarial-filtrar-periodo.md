# Plan: Ciclo salarial → filtrar período

**Spec:** `docs/superpowers/specs/2026-07-11-ciclo-salarial-filtrar-periodo-design.md`

## Files

| File | Change |
|------|--------|
| `apps/web/src/views/TransactionsView.vue` | Handler `applySalaryCycleFilter`; bloco clicável |
| `apps/web/e2e/transactions-budget-card.spec.ts` (ou novo) | E2E clique no ciclo |
| `apps/web/e2e/fixtures/mock-api.ts` | Garantir `salaryCycle` no user settings do mock se necessário |

## Tasks

1. **E2E red** — caso: user com paymentDay → Orçamento → click ciclo → label período com datas; painel Orçamento ainda visível.
2. **Handler** — `applySalaryCycleFilter()`: se `salaryCycle`, set `period` = `[start, end]`, `applyFilters()`, não muda `activePanel`.
3. **UI** — wrapper button/link no `.salary-cycle` quando há ciclo; estilos hover/cursor.
4. **Green** — `pnpm test:e2e` no spec afetado.
