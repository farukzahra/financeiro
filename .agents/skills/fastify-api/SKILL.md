---
name: fastify-api
description: Fastify API patterns for apps/api in this monorepo. Use when adding or changing routes, auth, imports, transactions, categories, rules, budget, or shared Zod contracts.
---

# Fastify API (Financeiro)

## Layout

| Path | Role |
|------|------|
| `apps/api/src/index.ts` | Bootstrap, CORS, multipart, route registration |
| `apps/api/src/auth.ts` | Session cookie auth (`requireUser`) |
| `apps/api/src/routes/*.ts` | Route modules |
| `apps/api/src/services/*.ts` | Domain logic (parser, categorizer, normalize, …) |
| `packages/shared` | Zod schemas shared with the web client |

## Conventions

1. Register routes via `registerXRoutes(app: FastifyInstance)`.
2. Protect handlers with `await requireUser(req, reply)` — scope queries by `user.id`.
3. Validate bodies with Zod from `@financeiro/shared` (`safeParse` → 400 on failure).
4. Money and dates travel as **strings** in JSON (decimal / `YYYY-MM-DD`).
5. Keep pure domain functions in `services/` with Vitest unit tests (`*.test.ts`), no real DB.
6. Dev port **3001**; web proxies `/api` → API (prefix stripped).

## Adding an endpoint

1. Add/extend Zod schema in `packages/shared` if the contract changes.
2. Implement route in the right `routes/*.ts` module (or new module + register in `index.ts`).
3. Update `apps/web/src/lib/api.ts` client types and callers.
4. Unit-test domain helpers; E2E mocks go in `apps/web/e2e/fixtures/mock-api.ts`.

## Auth notes

- Cookie HTTP-only session; `AUTH_SECRET` required in real environments.
- `app_user.settings` JSONB holds UI preferences (e.g. `transactionsFilters`).
