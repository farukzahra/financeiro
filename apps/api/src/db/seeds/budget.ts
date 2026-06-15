import "dotenv/config";
import { db, sql } from "../client.js";
import { budgetItems, users } from "../schema.js";
import { eq } from "drizzle-orm";

const SEED: { descricao: string; diaVencimento: number | null; valorMensal: string }[] = [
  { descricao: "Celular Khalil", diaVencimento: 12, valorMensal: "70.00" },
  { descricao: "Celular Faruk + Rima", diaVencimento: 12, valorMensal: "150.00" },
  { descricao: "Unimed", diaVencimento: 15, valorMensal: "1500.00" },
  { descricao: "Internet", diaVencimento: 15, valorMensal: "150.00" },
  { descricao: "Imposto", diaVencimento: 15, valorMensal: "133.20" },
  { descricao: "Luz", diaVencimento: 15, valorMensal: "600.00" },
  { descricao: "Gasolina", diaVencimento: null, valorMensal: "1500.00" },
  { descricao: "Mercado e Alim.", diaVencimento: null, valorMensal: "5000.00" },
  { descricao: "Gas", diaVencimento: null, valorMensal: "200.00" },
  { descricao: "Farmacia", diaVencimento: null, valorMensal: "500.00" },
  { descricao: "Empregada", diaVencimento: null, valorMensal: "0.00" },
  { descricao: "Dentista Khalil", diaVencimento: null, valorMensal: "200.00" },
];

async function main() {
  const legacy = await db.query.users.findFirst({
    where: eq(users.googleSub, "__legacy__"),
  });
  if (!legacy) {
    throw new Error("Usuario legado nao encontrado. Rode as migrations antes do seed de orcamento.");
  }

  for (const item of SEED) {
    await db
      .insert(budgetItems)
      .values({ ...item, userId: legacy.id, ativo: true })
      .onConflictDoNothing();
  }
  console.log(`${SEED.length} budget items seeded.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
