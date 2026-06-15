import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { budgetItems } from "../db/schema.js";
import {
  BudgetItemCreateSchema,
  BudgetItemUpdateSchema,
} from "@financeiro/shared";
import { requireUser } from "../auth.js";

export async function registerBudgetRoutes(app: FastifyInstance) {
  app.get("/budget", async (req, reply) => {
    const user = await requireUser(req, reply);
    return db
      .select()
      .from(budgetItems)
      .where(eq(budgetItems.userId, user.id))
      .orderBy(budgetItems.descricao);
  });

  app.post("/budget", async (req, reply) => {
    const user = await requireUser(req, reply);
    const parsed = BudgetItemCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;
    const [row] = await db
      .insert(budgetItems)
      .values({
        userId: user.id,
        descricao: data.descricao,
        categoriaId: data.categoriaId ?? null,
        diaVencimento: data.diaVencimento ?? null,
        valorMensal: data.valorMensal,
        ativo: data.ativo ?? true,
      })
      .returning();
    return row;
  });

  app.patch<{ Params: { id: string } }>("/budget/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    const parsed = BudgetItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const set: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.descricao !== undefined) set.descricao = d.descricao;
    if (d.categoriaId !== undefined) set.categoriaId = d.categoriaId;
    if (d.diaVencimento !== undefined) set.diaVencimento = d.diaVencimento;
    if (d.valorMensal !== undefined) set.valorMensal = d.valorMensal;
    if (d.ativo !== undefined) set.ativo = d.ativo;
    if (Object.keys(set).length === 0) return reply.code(400).send({ error: "Nada para atualizar" });
    const [row] = await db
      .update(budgetItems)
      .set(set)
      .where(and(eq(budgetItems.userId, user.id), eq(budgetItems.id, req.params.id)))
      .returning();
    if (!row) return reply.code(404).send({ error: "Nao encontrado" });
    return row;
  });

  app.delete<{ Params: { id: string } }>("/budget/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    const [row] = await db
      .delete(budgetItems)
      .where(and(eq(budgetItems.userId, user.id), eq(budgetItems.id, req.params.id)))
      .returning();
    if (!row) return reply.code(404).send({ error: "Nao encontrado" });
    return { ok: true };
  });
}
