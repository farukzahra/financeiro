import type { FastifyInstance } from "fastify";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "../db/client.js";
import { categoryRules, transactions } from "../db/schema.js";
import { CategoryRuleCreateSchema } from "@financeiro/shared";

export async function registerRulesRoutes(app: FastifyInstance) {
  app.get("/rules", async () => {
    return db.select().from(categoryRules).orderBy(categoryRules.prioridade);
  });

  app.post("/rules", async (req, reply) => {
    const parsed = CategoryRuleCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [row] = await db
      .insert(categoryRules)
      .values({
        categoriaId: parsed.data.categoriaId,
        tipoPadrao: parsed.data.tipoPadrao,
        padrao: parsed.data.padrao,
        prioridade: parsed.data.prioridade ?? 100,
        ativa: parsed.data.ativa ?? true,
      })
      .returning();
    return row;
  });

  app.patch<{ Params: { id: string } }>("/rules/:id", async (req, reply) => {
    const parsed = CategoryRuleCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [row] = await db
      .update(categoryRules)
      .set(parsed.data)
      .where(eq(categoryRules.id, req.params.id))
      .returning();
    if (!row) return reply.code(404).send({ error: "Nao encontrada" });
    return row;
  });

  // GET /rules/preview?padrao=&tipo=
  app.get<{ Querystring: { padrao?: string; tipo?: "substring" | "regex" } }>(
    "/rules/preview",
    async (req) => {
      const padrao = (req.query.padrao ?? "").trim();
      if (!padrao) return { chaves: [] };
      const tipo = req.query.tipo ?? "substring";
      const rows =
        tipo === "regex"
          ? await db
              .select({
                chave: transactions.chaveNormalizada,
                qtd: drizzleSql<number>`count(*)::int`,
              })
              .from(transactions)
              .where(drizzleSql`${transactions.chaveNormalizada} ~* ${padrao}`)
              .groupBy(transactions.chaveNormalizada)
              .limit(20)
          : await db
              .select({
                chave: transactions.chaveNormalizada,
                qtd: drizzleSql<number>`count(*)::int`,
              })
              .from(transactions)
              .where(drizzleSql`${transactions.chaveNormalizada} ILIKE ${`%${padrao}%`}`)
              .groupBy(transactions.chaveNormalizada)
              .limit(20);
      return { chaves: rows };
    },
  );
}
