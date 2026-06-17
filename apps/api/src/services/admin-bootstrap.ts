import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { budgetItems, categoryRules, users } from "../db/schema.js";

const UserSettingsSchema = z
  .object({
    budgetOrder: z.array(z.string().uuid()).optional(),
    transactionsFilters: z.record(z.unknown()).optional(),
  })
  .passthrough();

export async function copyAdminConfigToNewUser(newUserId: string): Promise<void> {
  const admin = await db.query.users.findFirst({
    where: eq(users.role, "admin"),
    orderBy: asc(users.createdAt),
  });
  if (!admin) return;

  const adminRules = await db
    .select()
    .from(categoryRules)
    .where(eq(categoryRules.userId, admin.id));

  if (adminRules.length > 0) {
    await db.insert(categoryRules).values(
      adminRules.map((rule) => ({
        userId: newUserId,
        categoriaId: rule.categoriaId,
        tipoPadrao: rule.tipoPadrao,
        padrao: rule.padrao,
        prioridade: rule.prioridade,
        ativa: rule.ativa,
      })),
    );
  }

  const adminBudget = await db
    .select()
    .from(budgetItems)
    .where(eq(budgetItems.userId, admin.id));

  const budgetIdMap = new Map<string, string>();
  for (const item of adminBudget) {
    const [created] = await db
      .insert(budgetItems)
      .values({
        userId: newUserId,
        descricao: item.descricao,
        categoriaId: item.categoriaId,
        diaVencimento: item.diaVencimento,
        valorMensal: item.valorMensal,
        ativo: item.ativo,
      })
      .returning({ id: budgetItems.id });
    budgetIdMap.set(item.id, created.id);
  }

  const adminSettings = UserSettingsSchema.parse(admin.settings ?? {});
  const settings: Record<string, unknown> = { ...adminSettings };

  if (adminSettings.budgetOrder?.length) {
    settings.budgetOrder = adminSettings.budgetOrder
      .map((id) => budgetIdMap.get(id))
      .filter((id): id is string => Boolean(id));
  }

  if (Object.keys(settings).length > 0) {
    await db
      .update(users)
      .set({ settings, updatedAt: new Date() })
      .where(eq(users.id, newUserId));
  }
}
