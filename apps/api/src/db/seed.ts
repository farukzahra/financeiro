import "dotenv/config";
import { db, sql } from "./client.js";
import { categories } from "./schema.js";
import { sql as drizzleSql } from "drizzle-orm";

// Categorias simplificadas combinadas com docs/parser-categorizacao-nubank.md / docs/PLANO_SISTEMA.md.
const SEED_CATEGORIES = [
  { id: "ALIMENTACAO", descricao: "Alimentacao (mercado e restaurante)" },
  { id: "FARMACIA", descricao: "Farmacia / remedios" },
  { id: "SAUDE", descricao: "Saude (consultas, planos)" },
  { id: "GASOLINA", descricao: "Gasolina / combustivel" },
  { id: "TRANSPORTE", descricao: "Transporte (estacionamento, app)" },
  { id: "COMPRAS", descricao: "Compras gerais" },
  { id: "AGRO", descricao: "Agropecuaria" },
  { id: "VIAGEM", descricao: "Viagem / hospedagem" },
  { id: "ACADEMIA", descricao: "Academia / esporte" },
  { id: "PIX", descricao: "Transferencias Pix / TED" },
  { id: "APLICACAO RDB", descricao: "Aplicacao em RDB" },
  { id: "RESGATE RDB", descricao: "Resgate de RDB" },
  { id: "FATURA GENERICA", descricao: "Pagamento de fatura" },
  { id: "DEBITO EM CONTA", descricao: "Debito automatico" },
  { id: "SAQUE", descricao: "Saque em dinheiro" },
  { id: "OUTROS", descricao: "Sem categoria definida" },
];

async function main() {
  for (const c of SEED_CATEGORIES) {
    await db
      .insert(categories)
      .values({ ...c, ativa: true })
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          descricao: drizzleSql`EXCLUDED.descricao`,
        },
      });
  }
  console.log(`${SEED_CATEGORIES.length} categorias upserted.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
