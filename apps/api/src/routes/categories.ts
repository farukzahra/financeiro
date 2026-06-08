import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { categories } from "../db/schema.js";
import { CategoryUpsertSchema } from "@financeiro/shared";

export async function registerCategoriesRoutes(app: FastifyInstance) {
  app.get("/categories", async () => {
    return db.select().from(categories).orderBy(categories.id);
  });

  app.post("/categories", async (req, reply) => {
    const parsed = CategoryUpsertSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [row] = await db
      .insert(categories)
      .values({ ...parsed.data, ativa: parsed.data.ativa ?? true })
      .onConflictDoNothing()
      .returning();
    if (!row) return reply.code(409).send({ error: "Categoria ja existe" });
    return row;
  });

  app.patch<{ Params: { id: string } }>("/categories/:id", async (req, reply) => {
    const parsed = CategoryUpsertSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const [row] = await db
      .update(categories)
      .set(parsed.data)
      .where(eq(categories.id, req.params.id))
      .returning();
    if (!row) return reply.code(404).send({ error: "Nao encontrada" });
    return row;
  });
}
