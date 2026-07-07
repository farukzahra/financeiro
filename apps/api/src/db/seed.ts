import "dotenv/config";
import { db, sql } from "./client.js";
import { categories } from "./schema.js";
import { sql as drizzleSql } from "drizzle-orm";

const SEED_CATEGORIES = [
  { code: "ALIMENTACAO", descricao: "Alimentação (mercado e restaurante)" },
  { code: "FARMACIA", descricao: "Farmácia / remédios" },
  { code: "SAUDE", descricao: "Saúde (consultas, planos)" },
  { code: "GASOLINA", descricao: "Gasolina / combustível" },
  { code: "TRANSPORTE", descricao: "Transporte (estacionamento, app)" },
  { code: "COMPRAS", descricao: "Compras gerais" },
  { code: "AGRO", descricao: "Agropecuária" },
  { code: "VIAGEM", descricao: "Viagem / hospedagem" },
  { code: "ACADEMIA", descricao: "Academia / esporte" },
  { code: "PIX", descricao: "Transferências Pix / TED" },
  { code: "APLICACAO RDB", descricao: "Aplicação em RDB" },
  { code: "RESGATE RDB", descricao: "Resgate de RDB" },
  { code: "FATURA GENERICA", descricao: "Pagamento de fatura" },
  { code: "DEBITO EM CONTA", descricao: "Débito automático" },
  { code: "SAQUE", descricao: "Saque em dinheiro" },
  { code: "OUTROS", descricao: "Sem categoria definida" },
];

async function main() {
  for (const c of SEED_CATEGORIES) {
    await db
      .insert(categories)
      .values({ ...c, ativa: true })
      .onConflictDoUpdate({
        target: categories.code,
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
