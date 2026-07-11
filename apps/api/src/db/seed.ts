import "dotenv/config";
import { eq } from "drizzle-orm";
import { sql as drizzleSql } from "drizzle-orm";
import { db, sql } from "./client.js";
import { categories, subscriptions, users } from "./schema.js";
import { syncCreditCardBudget } from "../services/credit-card-budget.js";

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

const SEED_SUBSCRIPTIONS_FARUK = [
  { nome: "Cursor AI Powered IDE", valorMensal: "110.53" },
  { nome: "Contabilizei", valorMensal: "195.00" },
  { nome: "Internet", valorMensal: "159.90" },
  { nome: "YouTube Premium", valorMensal: "53.90" },
  { nome: "Google One", valorMensal: "9.99" },
  { nome: "Celular Faruk", valorMensal: "45.00" },
  { nome: "VPS", valorMensal: "31.72" },
];

const FARUK_EMAIL = "farukz@gmail.com";

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

  const [faruk] = await db.select().from(users).where(eq(users.email, FARUK_EMAIL)).limit(1);
  if (faruk) {
    for (const s of SEED_SUBSCRIPTIONS_FARUK) {
      await db
        .insert(subscriptions)
        .values({
          userId: faruk.id,
          nome: s.nome,
          valorMensal: s.valorMensal,
        })
        .onConflictDoUpdate({
          target: [subscriptions.userId, subscriptions.nome],
          set: {
            valorMensal: drizzleSql`EXCLUDED.valor_mensal`,
          },
        });
    }
    await syncCreditCardBudget(faruk.id);
    console.log(
      `${SEED_SUBSCRIPTIONS_FARUK.length} assinaturas upserted for ${FARUK_EMAIL} + Cartão de Crédito sync.`,
    );
  } else {
    console.log(`Usuário ${FARUK_EMAIL} não encontrado; assinaturas não seedadas.`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
