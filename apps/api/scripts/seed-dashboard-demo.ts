import "dotenv/config";
import { and, eq, sql as drizzleSql } from "drizzle-orm";
import { db, sql } from "../src/db/client.js";
import { categories, imports, transactions, users } from "../src/db/schema.js";
import { SEED_CATEGORIES } from "../src/db/seeds/categories.js";
import { chaveAgrupamento } from "../src/services/normalize.js";

const DEMO_PREFIX = "demo-dashboard";
const DEFAULT_EMAIL = "farukz@gmail.com";
const MONTHS_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

type DemoRow = {
  data: string;
  valor: string;
  tipo: string;
  detalhe: string;
  categoria: string;
};

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function buildDemoRows(year: number, lastMonth: number): DemoRow[] {
  const rows: DemoRow[] = [];

  for (let month = 1; month <= lastMonth; month++) {
    const rnd = mulberry32(year * 100 + month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const date = (day: number) =>
      `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth))}`;
    const between = (min: number, max: number) => min + rnd() * (max - min);
    const money = (value: number) => value.toFixed(2);
    const push = (
      day: number,
      value: number,
      tipo: string,
      detalhe: string,
      categoria: string,
    ) => {
      rows.push({
        data: date(day),
        valor: money(value),
        tipo,
        detalhe,
        categoria,
      });
    };
    const entrada = (
      day: number,
      value: number,
      tipo: string,
      detalhe: string,
      categoria: string,
    ) => push(day, Math.abs(value), tipo, detalhe, categoria);
    const saida = (
      day: number,
      value: number,
      tipo: string,
      detalhe: string,
      categoria: string,
    ) => push(day, -Math.abs(value), tipo, detalhe, categoria);

    // Entradas
    entrada(5, 8850, "Transferência Recebida", "Salário - Empresa", "SALARIO");
    if (month % 3 === 0) {
      entrada(
        18,
        between(1250, 2400),
        "Transferência recebida pelo Pix",
        "Projeto freelance - Cliente",
        "PIX",
      );
    }
    if (month % 5 === 0) {
      entrada(
        21,
        between(180, 640),
        "Transferência recebida pelo Pix",
        "Reembolso - Amigo",
        "PIX",
      );
    }

    // Custos fixos
    saida(10, 2350, "Débito automático", "Aluguel + condomínio", "DEBITO EM CONTA");
    saida(18, between(180, 320), "Débito automático", "Conta de luz - Enel", "DEBITO EM CONTA");
    saida(20, 159.9, "Débito automático", "Internet - Vivo Fibra", "DEBITO EM CONTA");
    saida(22, 110.53, "Débito automático", "Cursor AI Powered IDE", "DEBITO EM CONTA");
    saida(24, 53.9, "Débito automático", "YouTube Premium", "DEBITO EM CONTA");
    saida(25, 195, "Débito automático", "Contabilizei", "DEBITO EM CONTA");
    saida(8, 45, "Débito automático", "Celular - Vivo", "DEBITO EM CONTA");
    saida(12, 489.9, "Débito automático", "Plano de saúde - Unimed", "SAUDE");
    saida(15, 139.9, "Débito automático", "Smart Fit", "ACADEMIA");

    // Alimentação
    const mercados = ["Supermercado Pão de Açúcar", "Assaí Atacadista", "Carrefour"];
    for (const [index, day] of [3, 11, 21].entries()) {
      saida(
        day,
        between(260, 540),
        "Compra no débito",
        mercados[index] as string,
        "ALIMENTAÇÃO",
      );
    }
    saida(6, between(45, 96), "Compra no débito", "iFood", "ALIMENTAÇÃO");
    saida(17, between(42, 88), "Compra no débito", "Rappi", "ALIMENTAÇÃO");
    saida(8, between(72, 178), "Compra no débito", "Restaurante - Almoço", "ALIMENTAÇÃO");
    saida(24, between(68, 165), "Compra no débito", "Restaurante - Jantar", "ALIMENTAÇÃO");

    // Combustível e transporte
    saida(7, between(185, 268), "Compra no débito", "Posto Ipiranga", "GASOLINA");
    saida(19, between(170, 250), "Compra no débito", "Posto Shell", "GASOLINA");
    saida(9, between(24, 68), "Compra no débito", "Uber", "TRANSPORTE");
    saida(23, between(18, 46), "Compra no débito", "Estacionamento", "TRANSPORTE");

    // Farmácia e compras
    saida(14, between(42, 190), "Compra no débito", "Drogasil", "FARMACIA");
    if (rnd() > 0.15) {
      saida(4, between(90, 460), "Compra no crédito", "Amazon", "COMPRAS");
    }
    if (rnd() > 0.25) {
      saida(16, between(60, 310), "Compra no crédito", "Mercado Livre", "COMPRAS");
    }

    // Agro
    saida(
      11,
      between(380, 980),
      "Compra no débito",
      "Casa do Produtor Rural",
      "AGRO",
    );

    // Viagem em alguns meses
    if ([1, 4, 7, 10].includes(month)) {
      saida(
        13,
        between(1200, 3200),
        "Compra no crédito",
        "Hospedagem - Viagem",
        "VIAGEM",
      );
    }

    // Pix, saque e outros
    saida(
      2,
      between(150, 700),
      "Transferência enviada pelo Pix",
      "Família - Ajuda",
      "PIX",
    );
    saida(
      26,
      between(120, 520),
      "Transferência enviada pelo Pix",
      "Amigo - Rateio",
      "PIX",
    );
    if (month % 2 === 0) {
      saida(27, between(200, 400), "Saque", "Saque em caixa eletrônico", "SAQUE");
    }
    if (rnd() > 0.45) {
      saida(28, between(60, 260), "Compra no débito", "Diversos", "OUTROS");
    }
  }

  return rows.sort((a, b) => a.data.localeCompare(b.data));
}

async function ensureCategories(): Promise<Map<string, string>> {
  for (const category of SEED_CATEGORIES) {
    await db
      .insert(categories)
      .values({ ...category, ativa: true })
      .onConflictDoUpdate({
        target: categories.code,
        set: { descricao: drizzleSql`EXCLUDED.descricao` },
      });
  }
  const all = await db.select().from(categories);
  return new Map(all.map((category) => [category.code, category.id]));
}

async function getOrCreateDemoImport(userId: string, year: number, firstDate: string, lastDate: string) {
  const hash = `__${DEMO_PREFIX}_${year}__`;
  const [existing] = await db
    .select({ id: imports.id })
    .from(imports)
    .where(and(eq(imports.userId, userId), eq(imports.hashSha256, hash)));
  if (existing) return existing.id;

  const [created] = await db
    .insert(imports)
    .values({
      userId,
      nomeArquivo: `${DEMO_PREFIX}-${year}.csv`,
      hashSha256: hash,
      conta: "demo",
      periodoInicio: firstDate,
      periodoFim: lastDate,
      totalLinhas: 0,
    })
    .returning({ id: imports.id });
  return created.id;
}

async function main() {
  const email = argValue("email") ?? DEFAULT_EMAIL;
  const year = Number(argValue("year") ?? new Date().getFullYear());
  if (!Number.isInteger(year) || year < 1970 || year > 2100) {
    throw new Error(`Ano invalido: ${year}`);
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const lastMonth = year === currentYear ? currentMonth : 12;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new Error(
      `Usuario ${email} nao encontrado. Crie a conta na tela de login ou passe --email=outro@email.com`,
    );
  }

  const categoryIds = await ensureCategories();
  const rows = buildDemoRows(year, lastMonth);
  if (rows.length === 0) throw new Error("Nenhuma linha gerada");

  const firstDate = rows[0]?.data ?? `${year}-01-01`;
  const lastDate = rows[rows.length - 1]?.data ?? `${year}-12-31`;
  const importId = await getOrCreateDemoImport(user.id, year, firstDate, lastDate);

  const removed = await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.userId, user.id),
        drizzleSql`${transactions.identificador} like ${`${DEMO_PREFIX}-${year}-%`}`,
      ),
    )
    .returning({ identificador: transactions.identificador });

  const values = rows.map((row, index) => {
    const categoriaId = categoryIds.get(row.categoria);
    if (!categoriaId) throw new Error(`Categoria ausente: ${row.categoria}`);
    return {
      identificador: `${DEMO_PREFIX}-${year}-${pad(index + 1)}`,
      userId: user.id,
      importId,
      data: row.data,
      valor: row.valor,
      descricaoRaw: `${row.tipo} - ${row.detalhe}`,
      tipo: row.tipo,
      detalhe: row.detalhe,
      chaveNormalizada: chaveAgrupamento(row.tipo, row.detalhe),
      categoriaId,
      categoryRuleId: null,
      regraAplicada: "demo",
      observacao: null,
    };
  });

  await db.insert(transactions).values(values).onConflictDoNothing();

  const entradas = rows
    .filter((row) => Number(row.valor) > 0)
    .reduce((acc, row) => acc + Number(row.valor), 0);
  const saidas = rows
    .filter((row) => Number(row.valor) < 0)
    .reduce((acc, row) => acc + Number(row.valor), 0);

  console.log(
    `Demo ${year} (${MONTHS_PT[0]}-${MONTHS_PT[lastMonth - 1]}): ${rows.length} transacoes para ${email}.`,
  );
  console.log(
    `Entradas ${entradas.toFixed(2)} | Saidas ${saidas.toFixed(2)} | Saldo ${(entradas + saidas).toFixed(2)}`,
  );
  console.log(`${removed.length} transacoes de demo anteriores removidas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
