import "dotenv/config";
import { eq } from "drizzle-orm";
import { BUDGET_ORIGEM_ASSINATURAS } from "@financeiro/shared";
import { db, sql } from "../src/db/client.js";
import { budgetItems, categories, users } from "../src/db/schema.js";
import {
  CREDIT_CARD_BUDGET_CATEGORY_CODE,
  syncCreditCardBudget,
} from "../src/services/credit-card-budget.js";

async function main() {
  await db
    .insert(categories)
    .values({
      code: CREDIT_CARD_BUDGET_CATEGORY_CODE,
      descricao: "Cartão de Crédito",
      ativa: true,
    })
    .onConflictDoUpdate({
      target: categories.code,
      set: { descricao: "Cartão de Crédito", ativa: true },
    });

  const [cartao] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.code, CREDIT_CARD_BUDGET_CATEGORY_CODE))
    .limit(1);

  if (!cartao) {
    throw new Error(`Categoria ${CREDIT_CARD_BUDGET_CATEGORY_CODE} não encontrada`);
  }

  const patched = await db
    .update(budgetItems)
    .set({ categoriaId: cartao.id })
    .where(eq(budgetItems.origem, BUDGET_ORIGEM_ASSINATURAS))
    .returning({ id: budgetItems.id, userId: budgetItems.userId });

  console.log(
    `datapatch: ${patched.length} budget_item(s) Cartão → ${CREDIT_CARD_BUDGET_CATEGORY_CODE}`,
  );

  const owners = [...new Set(patched.map((r) => r.userId))];
  for (const userId of owners) {
    await syncCreditCardBudget(userId);
  }

  const [faruk] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "farukz@gmail.com"))
    .limit(1);
  if (faruk && !owners.includes(faruk.id)) {
    await syncCreditCardBudget(faruk.id);
    console.log("sync extra for farukz@gmail.com");
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
