import "dotenv/config";
import { db, sql } from "./client.js";
import { categories } from "./schema.js";
import { sql as drizzleSql } from "drizzle-orm";

// Categorias simplificadas combinadas com docs/parser-categorizacao-nubank.md / docs/PLANO_SISTEMA.md.
const SEED_CATEGORIES = [
  { id: "ALIMENTACAO", letra: "A", descricao: "Alimentacao (mercado e restaurante)" },
  { id: "FARMACIA", letra: "F", descricao: "Farmacia / remedios" },
  { id: "SAUDE", letra: "F", descricao: "Saude (consultas, planos)" },
  { id: "GASOLINA", letra: "G", descricao: "Gasolina / combustivel" },
  { id: "TRANSPORTE", letra: "T", descricao: "Transporte (estacionamento, app)" },
  { id: "COMPRAS", letra: "C", descricao: "Compras gerais" },
  { id: "AGRO", letra: "R", descricao: "Agropecuaria" },
  { id: "VIAGEM", letra: "D", descricao: "Viagem / hospedagem" },
  { id: "ACADEMIA", letra: "K", descricao: "Academia / esporte" },
  { id: "PIX", letra: "Z", descricao: "Transferencias Pix / TED" },
  { id: "APLICACAO RDB", letra: "I", descricao: "Aplicacao em RDB" },
  { id: "RESGATE RDB", letra: "I", descricao: "Resgate de RDB" },
  { id: "FATURA GENERICA", letra: "X", descricao: "Pagamento de fatura" },
  { id: "DEBITO EM CONTA", letra: "D", descricao: "Debito automatico" },
  { id: "SAQUE", letra: "Q", descricao: "Saque em dinheiro" },
  { id: "OUTROS", letra: "S", descricao: "Sem categoria definida" },
];

async function main() {
  for (const c of SEED_CATEGORIES) {
    await db
      .insert(categories)
      .values({ ...c, ativa: true })
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          letra: drizzleSql`EXCLUDED.letra`,
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
