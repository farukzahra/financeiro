import { and, eq } from "drizzle-orm";
import { BUDGET_ORIGEM_ASSINATURAS } from "@financeiro/shared";
import { db } from "../db/client.js";
import { budgetItems, subscriptions } from "../db/schema.js";

export const CREDIT_CARD_BUDGET_DESCRICAO = "Cartão de Crédito";

export function sumMonthlyValues(values: string[]): string {
  const sum = values.reduce((acc, v) => acc + Number(v), 0);
  return sum.toFixed(2);
}

export function creditCardBudgetAction(sum: string): "upsert" | "delete" {
  return Number(sum) > 0 ? "upsert" : "delete";
}

export function isSystemBudgetOrigem(origem: string | null | undefined): boolean {
  return origem === BUDGET_ORIGEM_ASSINATURAS;
}

export async function syncCreditCardBudget(userId: string) {
  const rows = await db
    .select({ valorMensal: subscriptions.valorMensal })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  const sum = sumMonthlyValues(rows.map((r) => r.valorMensal));
  const action = creditCardBudgetAction(sum);

  const [existing] = await db
    .select()
    .from(budgetItems)
    .where(
      and(eq(budgetItems.userId, userId), eq(budgetItems.origem, BUDGET_ORIGEM_ASSINATURAS)),
    )
    .limit(1);

  if (action === "delete") {
    if (existing) {
      await db.delete(budgetItems).where(eq(budgetItems.id, existing.id));
    }
    return null;
  }

  if (existing) {
    const [row] = await db
      .update(budgetItems)
      .set({
        descricao: CREDIT_CARD_BUDGET_DESCRICAO,
        categoriaId: null,
        diaVencimento: null,
        valorMensal: sum,
        ativo: true,
      })
      .where(eq(budgetItems.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(budgetItems)
    .values({
      userId,
      descricao: CREDIT_CARD_BUDGET_DESCRICAO,
      categoriaId: null,
      diaVencimento: null,
      valorMensal: sum,
      ativo: true,
      origem: BUDGET_ORIGEM_ASSINATURAS,
    })
    .returning();
  return row;
}
