import type { FastifyInstance } from "fastify";
import { and, eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "../db/client.js";
import { categories, transactions } from "../db/schema.js";
import { parseStatsYear } from "../services/transaction-stats.js";
import { buildDashboard } from "../services/dashboard.js";
import { requireUser } from "../auth.js";

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { year?: string } }>("/dashboard", async (req, reply) => {
    const user = await requireUser(req, reply);
    const year = parseStatsYear(req.query.year);
    if (year == null) return reply.code(400).send({ error: "Ano invalido" });

    const yearRows = await db
      .select({
        year: drizzleSql<number>`extract(year from ${transactions.data})::int`,
      })
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .groupBy(drizzleSql`extract(year from ${transactions.data})`);

    const rows = await db
      .select({
        month: drizzleSql<number>`extract(month from ${transactions.data})::int`,
        categoriaId: transactions.categoriaId,
        code: categories.code,
        descricao: categories.descricao,
        entradas: drizzleSql<string>`coalesce(sum(case when ${transactions.valor} > 0 then ${transactions.valor} end), 0)`,
        saidas: drizzleSql<string>`coalesce(sum(case when ${transactions.valor} < 0 then ${transactions.valor} end), 0)`,
        qtd: drizzleSql<number>`count(*)::int`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoriaId, categories.id))
      .where(
        and(
          eq(transactions.userId, user.id),
          drizzleSql`extract(year from ${transactions.data}) = ${year}`,
        ),
      )
      .groupBy(
        drizzleSql`extract(month from ${transactions.data})`,
        transactions.categoriaId,
        categories.code,
        categories.descricao,
      );

    const years = [
      ...new Set([
        ...yearRows.map((row) => row.year),
        new Date().getFullYear(),
        year,
      ]),
    ].sort((a, b) => a - b);

    return {
      ...buildDashboard(year, rows),
      years,
    };
  });
}
