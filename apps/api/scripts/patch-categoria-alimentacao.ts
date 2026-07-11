import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db/client.js";
import { categories } from "../src/db/schema.js";

const OLD_CODE = "ALIMENTACAO";
const NEW_CODE = "ALIMENTAÇÃO";

async function main() {
  const updated = await db
    .update(categories)
    .set({ code: NEW_CODE })
    .where(eq(categories.code, OLD_CODE))
    .returning({ id: categories.id, code: categories.code });

  if (updated.length === 0) {
    const [existing] = await db
      .select({ id: categories.id, code: categories.code })
      .from(categories)
      .where(eq(categories.code, NEW_CODE))
      .limit(1);
    if (existing) {
      console.log(`datapatch: categoria já está com code ${NEW_CODE} (${existing.id})`);
    } else {
      console.log(`datapatch: nenhuma linha com code ${OLD_CODE} encontrada`);
    }
  } else {
    console.log(
      `datapatch: categoria ${OLD_CODE} → ${NEW_CODE} (${updated.map((r) => r.id).join(", ")})`,
    );
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
