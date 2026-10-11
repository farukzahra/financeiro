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
