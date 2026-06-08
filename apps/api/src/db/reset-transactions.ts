import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/financeiro";
const sql = postgres(url);
try {
  await sql`DELETE FROM "transaction"`;
  await sql`DELETE FROM "import"`;
  console.log("Limpo.");
} finally {
  await sql.end();
}
