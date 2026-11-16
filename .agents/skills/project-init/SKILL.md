---
name: project-init
description: >-
  Bootstrap Superpowers agent workflow in a project — docs/superpowers folders,
  mandatory skills (brainstorming, writing-plans, semantic-version, caveman-commit,
  dont-forget, recap, handoff, automate-before-manual, dont-be-lazy, validate-before-share,
  finish-with-dev-server, ask-before-architecture, diagrams-mermaid, ui-change-e2e),
  slash commands, AGENTS.md gates. Use when user invokes /init or asks to initialize
  agent conventions in a new or legacy repo.
disable-model-invocation: false
---

# Project init — bootstrap agent workflow

**Only when the user invokes `/init` or asks to initialize this repo** — never automatic.

Sets up Superpowers + Faruk mandatory skills in the **current project**. Does not scaffold apps, commit, or push.

## Summary (what init does)

| # | Action |
|---|--------|
| 1 | Create `docs/superpowers/specs/` and `plans/` (+ README) |
| 2 | Install **mandatory skills** at project scope |
| 3 | Ensure `/commit-push`, `/init`, `/recap`, and `/handoff` in `.cursor/commands/` |
| 4 | Optional: Cursor rules + `docs/release-history.json` for web apps |
| 5 | Merge **AGENTS.md** workflow table + automation + fresh-options gates (never replace a rich file) |

## Mandatory skills to install

### Superpowers (`obra/superpowers` via `skills-lock.json`)

| Skill | Gate |
|-------|------|
| `brainstorming` | No feature code before approved spec |
| `writing-plans` | Plan → `docs/superpowers/plans/` |
| `systematic-debugging` | Root cause before bug fixes |
| `verification-before-completion` | Evidence before "done" |

### Faruk (`farukzahra/agent-skills`)

| Skill | Gate |
|-------|------|
| `semantic-version` | Version bump **only** on `/commit-push` → `/sobre` |
| `caveman-commit` | Commit messages on `/commit-push` |
| `dont-forget` | Recurring rules → CI/hooks/codegen, not prose |
| `recap` | Session delivery recap → HTML in repo (`/recap`) |
| `handoff` | Compact handoff for next agent → OS temp dir (`/handoff`, `mattpocock/skills`) |
| `automate-before-manual` | Try PAT/SSH/API before manual steps (`../secrets/`) |
| `dont-be-lazy` | User lazy → API/MCP, vault, Cursor browser — agent finishes |
| `validate-before-share` | Verify URLs before sending to user |
| `finish-with-dev-server` | Dev server up, port conflict rules, test URLs |
| `ask-before-architecture` | Ask before stack/architecture choices |
| `diagrams-mermaid` | Mermaid only; validate syntax before show |
| `ui-change-e2e` | E2E on UI create/change/bugfix |

### Optional after init

- `skills-sh-maintainer` — **only** `agent-skills` repo

## Workflow

### 1. Inspect

Read `README.md`, `AGENTS.md`, `package.json`, `docs/stack.md`. Note stack only.

### 2. Superpowers folders

Create if missing (never delete existing specs/plans):

```
docs/superpowers/specs/
docs/superpowers/plans/
docs/superpowers/README.md
```

Template README: `farukzahra/agent-skills` → `reference/superpowers/docs-README.md` (or local clone path).

### 3. Install skills

Run the sync script (installs **all** current `farukzahra/agent-skills` packages, including any newly added skills):

```powershell
# From any machine with agent-skills cloned — relative to repo parent:
../agent-skills/scripts/sync-faruk-skills.ps1
```

Or manually:

```bash
npx skills experimental_install
npx skills add farukzahra/agent-skills -a cursor -y
```

(`-y` installs every skill in the package; omit `skills-sh-maintainer` outside `agent-skills` repo — the script handles that.)

**Handoff** (Matt Pocock — not in `farukzahra/agent-skills`):

```bash
npx skills add mattpocock/skills@handoff -a cursor -y
```

- No `skills-lock.json` → copy `skills-lock.core.json` from agent-skills, then `experimental_install`
- Existing full lock → `experimental_install` only; **do not overwrite**

**Stack skills** (if missing from lock):

| Signal | Add |
|--------|-----|
| Next.js | `vercel-react-best-practices`, `frontend-design` |
| Vue | `vue-best-practices`, `frontend-design` |
| Prisma | `prisma-cli`, `prisma-client-api`, `prisma-database-setup`, `prisma-postgres` |
| Playwright | `playwright-best-practices` |
| Fastify | `nodejs-backend-patterns` |

### 4. Slash commands

Copy from agent-skills repo if missing:

- `reference/commands/commit-push.md` → `.cursor/commands/commit-push.md`
- `reference/commands/init.md` → `.cursor/commands/init.md`
- `reference/commands/recap.md` → `.cursor/commands/recap.md`
- `reference/commands/handoff.md` → `.cursor/commands/handoff.md`

Deploy config: `docs/commit-push.json` (see `reference/commands/deploy-manifest.json`).

### 5. Cursor rules

Always copy from agent-skills:

- `reference/rules/automate-before-manual.mdc` → `.cursor/rules/automate-before-manual.mdc`
- `reference/rules/fresh-options-on-open.mdc` → `.cursor/rules/fresh-options-on-open.mdc`

If `.cursor/rules/` was empty, also from Faruk Base: `finish-task-dev-server.mdc` (or stack-specific dev-server rule).

Or run `../agent-skills/scripts/sync-agent-conventions.ps1` from any repo parent to refresh skills + rule + `AGENTS.md` automation section across all git repos.

### 6. Release history (web apps)

Create `docs/release-history.json` at `0.1.0` if missing. Bump only via `/commit-push`.

### 7. AGENTS.md

Append workflow table if missing — see [reference/agents-snippet.md](reference/agents-snippet.md). Also append/merge `reference/agents-automation-snippet.md` and `reference/agents-data-freshness-snippet.md` (combos reload from the DB every time they open).

### 8. Report

List: folders created, skills installed, commands ready (`/init`, `/commit-push`, `/recap`, `/handoff`), next step = `brainstorming`.

## Do not

- Run without user invoking `/init`
- Overwrite lock, specs, or plans without permission
- Commit or push (`/commit-push` handles ship)
- Install `skills-sh-maintainer` outside agent-skills

## Paths (Faruk local)

| Item | Path |
|------|------|
| Agent-skills repo | `../agent-skills` (sibling of project repos) |
| Secrets vault | `../secrets/` (never absolute paths in skills) |
| Sync all Faruk skills | `../agent-skills/scripts/sync-faruk-skills.ps1` |
