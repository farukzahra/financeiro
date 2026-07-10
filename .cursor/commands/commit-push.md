# Commit and push

Commit project changes and push to the tracked remote. Follow financeiro conventions (not Faruk Base Next/Prisma defaults).

## Preconditions

- User explicitly invoked `/commit-push` (or asked to commit and push).
- Never commit secrets (`.env`, `planos/vps-secrets/`, credentials).
- Never force-push to `main`/`master`.
- Never skip hooks unless the user explicitly asked.

## Step 1 — Inspect (parallel)

```bash
git status
git diff
git diff --cached
git log -5 --oneline
git branch -vv
```

## Step 2 — Version bump (`semantic-version` skill)

**Only bump on `/commit-push` (or explicit release request).**

If the diff is **user-visible** (UI, API behavior users notice):

1. Apply `semantic-version` → update `docs/release-history.json` (Portuguese `title`/`summary`).
2. Align all workspace `package.json` versions with `currentVersion` (`package.json`, `apps/api`, `apps/web`, `packages/shared`).
3. About page reads that JSON — do **not** hardcode history in `AboutView.vue`.
4. Run `pnpm release:check` (or rely on pre-commit hook).

Skip bump for internal-only refactors, docs-only, test-only, or CI-only with no user-facing change.

## Step 3 — Commit message (`caveman-commit` skill)

- Conventional Commits, **English**
- Subject ≤50 chars when possible

## Step 4 — Commit

```bash
git add <relevant files>
git commit -m "<subject>" -m "<optional body>"
```

PowerShell: use multiple `-m` flags or a here-string. Do not use bash HEREDOC.

If nothing to commit, stop — do not push.

## Step 5 — Link release entry to commit

If `docs/release-history.json` was updated and the newest entry has `"commit": null`:

1. `git rev-parse --short HEAD`
2. Set `commit` on that entry
3. Second commit: `chore: link release entry to commit <sha>`

## Step 6 — Push

```bash
git push origin HEAD
```

## Step 7 — Verify Deploy VPS CI

After push to `main`/`master`:

1. Read PAT from `planos/vps-secrets/github-pat.txt` (gitignored; never commit).
2. Poll `GET /repos/farukzahra/financeiro/actions/runs?per_page=3`.
3. Wait until the run for this SHA completes.
4. If **build** fails: reproduce with `pnpm build` locally, fix, new commit/push, recheck.
5. If **build** ok and **deploy** fails: inspect deploy logs (SSH/VPS/migrations).
6. Report run URL and final status to the user.

## Step 8 — Confirm

Report: commit SHA(s), messages, branch, new version (if bumped), Actions URL/status.
