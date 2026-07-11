import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  SubscriptionCreateSchema,
  SubscriptionUpdateSchema,
} from "@financeiro/shared";
import { requireUser } from "../auth.js";
import { db } from "../db/client.js";
import { subscriptions } from "../db/schema.js";
import { syncCreditCardBudget } from "../services/credit-card-budget.js";

export async function registerSubscriptionRoutes(app: FastifyInstance) {
  app.get("/subscriptions", async (req, reply) => {
    const user = await requireUser(req, reply);
    return db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .orderBy(subscriptions.nome);
  });

  app.post("/subscriptions", async (req, reply) => {
    const user = await requireUser(req, reply);
    const parsed = SubscriptionCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const data = parsed.data;
    try {
      const [row] = await db
        .insert(subscriptions)
        .values({
          userId: user.id,
          nome: data.nome,
          valorMensal: data.valorMensal,
        })
        .returning();
      await syncCreditCardBudget(user.id);
      return row;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        return reply.code(409).send({ error: "Já existe assinatura com esse nome" });
      }
      throw err;
    }
  });

  app.patch<{ Params: { id: string } }>("/subscriptions/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    const parsed = SubscriptionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const set: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.nome !== undefined) set.nome = d.nome;
    if (d.valorMensal !== undefined) set.valorMensal = d.valorMensal;
    if (Object.keys(set).length === 0) return reply.code(400).send({ error: "Nada para atualizar" });
    try {
      const [row] = await db
        .update(subscriptions)
        .set(set)
        .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.id, req.params.id)))
        .returning();
      if (!row) return reply.code(404).send({ error: "Nao encontrado" });
      await syncCreditCardBudget(user.id);
      return row;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        return reply.code(409).send({ error: "Já existe assinatura com esse nome" });
      }
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/subscriptions/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    const [row] = await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.id, req.params.id)))
      .returning();
    if (!row) return reply.code(404).send({ error: "Nao encontrado" });
    await syncCreditCardBudget(user.id);
    return { ok: true };
  });
}
