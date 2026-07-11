---
name: vuetify-ui
description: Vuetify 3 UI patterns for apps/web in this monorepo. Use when building or changing Vue views, tables, filters, dialogs, theme, or layout in the financeiro frontend.
---

# Vuetify UI (Financeiro)

## Stack

- Vue 3 + `<script setup lang="ts">`
- Vuetify 3 (`vite-plugin-vuetify`, autoImport)
- Pinia stores, Vue Router, Axios (`apps/web/src/lib/api.ts`)
- Global CSS in `apps/web/src/styles.css` + scoped SFC styles
- MDI icons (`@mdi/font`)

## Hard rules for this project

1. **No pagination** on data tables — `items-per-page="-1"` and `hide-default-footer`.
2. Prefer stable row order from code when clickable column sort would hurt inline actions.
3. E2E for every new/changed screen: `apps/web/e2e/` with `mock-api.ts` (never write to the real DB).
4. User-facing copy in **Portuguese** with correct accents.
5. Money/date formatting via `apps/web/src/lib/format.ts` (`fmtMoneyBR`, `fmtDateBR`, `classMoney`).
6. Category labels: short code via `categoryPillLabel` / `categoryCode` in lists; description only where explicitly needed (filters/settings).
7. **Surfaces:** page background stays cool blue `#F8FAFC`; any form or settings content block on that background must use global `.app-panel` (white surface + border). Do not place bare fields on the page background. Single UI font: IBM Plex Sans + `tabular-nums` for money (no second font family).

## Patterns

- Tables: `v-data-table` with `must-sort` when sort is controlled via `v-model:sort-by`.
- Feedback: project snackbar/confirm composables (not ad-hoc alerts).
- Modals: dedicated components under `apps/web/src/components/`.
- Persist user prefs through auth settings (`transactionsFilters`, sort, panels).

## Also load

- `vue-best-practices` for Composition API / SFC structure.
- `frontend-design` only when reshaping visual identity (otherwise keep existing blue/orange theme).
- `playwright-best-practices` when writing E2E.
