import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { categories } from "../db/schema.js";
import { CategoryCreateSchema, CategoryUpdateSchema } from "@financeiro/shared";
import { requireUser } from "../auth.js";

export async function registerCategoriesRoutes(app: FastifyInstance) {
  app.get("/categories", async (req, reply) => {
    await requireUser(req, reply);
    return db.select().from(categories).orderBy(categories.code);
  });

  app.post("/categories", async (req, reply) => {
    await requireUser(req, reply);
    const parsed = CategoryCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [row] = await db
      .insert(categories)
      .values({
        code: parsed.data.code.trim().toUpperCase(),
        descricao: parsed.data.descricao,
        ativa: parsed.data.ativa ?? true,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) return reply.code(409).send({ error: "Categoria ja existe" });
    return row;
  });

  app.patch<{ Params: { id: string } }>("/categories/:id", async (req, reply) => {
    await requireUser(req, reply);
    const parsed = CategoryUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const set: Record<string, unknown> = { ...parsed.data };
    if (typeof set.code === "string") set.code = set.code.trim().toUpperCase();
    const [row] = await db
      .update(categories)
      .set(set)
      .where(eq(categories.id, req.params.id))
      .returning();
    if (!row) return reply.code(404).send({ error: "Nao encontrada" });
    return row;
  });
}
