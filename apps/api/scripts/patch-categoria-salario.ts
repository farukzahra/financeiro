import "dotenv/config";
import { sql as drizzleSql } from "drizzle-orm";
import { db, sql } from "../src/db/client.js";
import { categories } from "../src/db/schema.js";

const CODE = "SALARIO";
const DESCRICAO = "Salário";

async function main() {
  await db
    .insert(categories)
    .values({ code: CODE, descricao: DESCRICAO, ativa: true })
    .onConflictDoUpdate({
      target: categories.code,
      set: {
        descricao: drizzleSql`EXCLUDED.descricao`,
        ativa: true,
      },
    });

  console.log(`datapatch: categoria ${CODE} upserted`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
