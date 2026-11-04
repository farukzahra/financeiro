import "dotenv/config";
import { sql as drizzleSql } from "drizzle-orm";
import { db, sql } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { DEFAULT_MONTHLY_SPENDING_LIMIT } from "@financeiro/shared";

async function main() {
  const updated = await db
    .update(users)
    .set({
      settings: drizzleSql`jsonb_set(
        coalesce(${users.settings}, '{}'::jsonb),
        '{monthlySpendingLimit}',
        to_jsonb(${DEFAULT_MONTHLY_SPENDING_LIMIT}::text),
        true
      )`,
    })
    .where(drizzleSql`${users.settings}->>'monthlySpendingLimit' is null`)
    .returning({ email: users.email });

  console.log(
    `${updated.length} usuario(s) atualizado(s) com limite mensal ${DEFAULT_MONTHLY_SPENDING_LIMIT}.`,
  );
  for (const user of updated) console.log(`- ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
