import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db/client.js";
import { users } from "../src/db/schema.js";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  const email = process.argv[2] ?? "farukz@gmail.com";
  const password = process.argv[3] ?? "kuraf007";

  const [updated] = await db
    .update(users)
    .set({ passwordHash: hashPassword(password), updatedAt: new Date() })
    .where(eq(users.email, email))
    .returning({ email: users.email });

  if (!updated) throw new Error(`Usuario ${email} nao encontrado`);
  console.log(`Senha atualizada para ${updated.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
