# AGENTS.md

## Superpowers workflow

| Phase | Skill | Output |
|-------|-------|--------|
| Design | `brainstorming` | `docs/superpowers/specs/` |
| Plan | `writing-plans` | `docs/superpowers/plans/` |
| Verify | `verification-before-completion` | Evidence before done |
| Ship | `/commit-push` | Version + push + CI |

Run `/init` for full bootstrap.
## Agent automation (mandatory)

Before manual steps (login, browser click, "run this yourself"): read **`automate-before-manual`** (`.agents/skills/`). If the user refuses manual work, also **`dont-be-lazy`**. Secrets vault: `../secrets/` (see `AGENTS.md` or `secrets.local.md`). Cursor rule: `.cursor/rules/automate-before-manual.mdc`.

Invoke `/init` to (re)install skills and this rule.

## Dados frescos em combos (mandatory)

Toda combo, select, autocomplete ou filtro que lista dados do banco (categorias, tipos, usuários, status, contas) rebusca a lista na API **toda vez que o usuário abrir o campo** — nunca só o cache carregado no login ou no mount. Se a busca falhar, mantenha a lista anterior e abra o menu normalmente. Depois de criar ou editar um item em outra tela/modal, a próxima abertura já mostra o item novo, sem o usuário recarregar a página. Cursor rule: `.cursor/rules/fresh-options-on-open.mdc`. Referência: `apps/web/src/stores/reference.ts` (`reloadTipos`), `TransactionsView.vue` (`startEditCell`) e `ManualTransactionModal.vue`.
