import "dotenv/config";
import { sql as drizzleSql } from "drizzle-orm";
import { db, sql } from "../src/db/client.js";
import { budgetItems } from "../src/db/schema.js";

const NEW = "Alimentação";

async function main() {
  const updated = await db
    .update(budgetItems)
    .set({ descricao: NEW })
    .where(drizzleSql`lower(btrim(${budgetItems.descricao})) = 'alimentacao'`)
    .returning({ id: budgetItems.id, descricao: budgetItems.descricao });

  console.log(
    updated.length === 0
      ? `datapatch: nenhum budget_item "Alimentacao" (sem acento)`
      : `datapatch: ${updated.length} budget_item(s) → "${NEW}" (${updated.map((r) => r.id).join(", ")})`,
  );
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
