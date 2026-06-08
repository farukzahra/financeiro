import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://financeiro:financeiro@localhost:5432/financeiro";

async function main() {
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  console.log("Running migrations against", connectionString);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  await sql.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
