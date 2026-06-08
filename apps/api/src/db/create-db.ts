import postgres from "postgres";

const url = "postgres://postgres:postgres@localhost:5432/postgres";
const sql = postgres(url);
try {
  const r = await sql`SELECT 1 FROM pg_database WHERE datname = 'financeiro'`;
  if (r.length === 0) {
    await sql.unsafe("CREATE DATABASE financeiro");
    console.log("Database 'financeiro' criado.");
  } else {
    console.log("Database 'financeiro' ja existe.");
  }
} finally {
  await sql.end();
}
