---
name: drizzle-orm
description: Drizzle ORM + PostgreSQL patterns for this monorepo (apps/api). Use when editing schema.ts, writing migrations, queries, seeds, or any database change in the financeiro API.
---

# Drizzle ORM (Financeiro)

## Layout

| Path | Role |
|------|------|
| `apps/api/src/db/schema.ts` | Tables (source of truth) |
| `apps/api/src/db/migrations/` | Generated SQL + meta (commit with schema) |
| `apps/api/src/db/client.ts` | DB client |
| `apps/api/src/db/migrate.ts` | Apply migrations |
| `apps/api/src/db/seed.ts` | Seed data |

## Commands (repo root)

```bash
pnpm db:generate   # drizzle-kit generate from schema
pnpm db:migrate    # apply migrations
pnpm db:seed       # seed categories / baseline
```

## Rules

1. **UUID PKs** — every table uses `uuid("id").primaryKey().defaultRandom()`. Human-readable codes (email, Nubank id, category `code`) are separate `UNIQUE` columns, never the PK. FKs reference parent `id`.
2. **Never edit applied migrations** — add a new migration instead.
3. Schema change = update `schema.ts` + generate migration + commit both in the same delivery.
4. Money as `numeric` / string decimals in API contracts (preserve precision).
5. User-scoped tables include `userId` FK to `app_user.id`.
6. Prefer Drizzle query builder; use `sql` / `drizzleSql` for aggregates and Postgres-specific expressions.

## Workflow

1. Edit `schema.ts`.
2. `pnpm db:generate` — review SQL under `migrations/`.
3. `pnpm db:migrate` locally.
4. Update routes/services/Zod shared types that touch the table.
5. Add/adjust unit tests for domain logic (no real DB in Vitest).
