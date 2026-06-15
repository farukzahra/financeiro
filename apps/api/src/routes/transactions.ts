import type { FastifyInstance } from "fastify";
import { and, between, eq, gte, ilike, inArray, lte, or, sql as drizzleSql } from "drizzle-orm";
import { db } from "../db/client.js";
import { transactions, imports } from "../db/schema.js";
import { TransactionUpdateSchema, TransactionCreateSchema } from "@financeiro/shared";
import { chaveAgrupamento } from "../services/normalize.js";
import { requireUser } from "../auth.js";

const MANUAL_IMPORT_HASH = "__manual__";

async function getOrCreateManualImportId(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: imports.id })
    .from(imports)
    .where(and(eq(imports.userId, userId), eq(imports.hashSha256, MANUAL_IMPORT_HASH)));
  if (existing) return existing.id;

  const [created] = await db
    .insert(imports)
    .values({
      userId,
      nomeArquivo: "__manual__",
      hashSha256: MANUAL_IMPORT_HASH,
      conta: "manual",
      periodoInicio: "1970-01-01",
      periodoFim: "1970-01-01",
      totalLinhas: 0,
    })
    .returning({ id: imports.id });
  return created.id;
}

export async function registerTransactionsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      from?: string;
      to?: string;
      category?: string | string[];
      q?: string;
      minValue?: string;
      maxValue?: string;
    };
  }>("/transactions", async (req, reply) => {
    const user = await requireUser(req, reply);
    const { from, to, category, q, minValue, maxValue } = req.query;
    const filters = [eq(transactions.userId, user.id)];

    if (from && to) filters.push(between(transactions.data, from, to));
    else if (from) filters.push(gte(transactions.data, from));
    else if (to) filters.push(lte(transactions.data, to));

    const cats = Array.isArray(category) ? category : category ? [category] : [];
    if (cats.length) filters.push(inArray(transactions.categoriaId, cats));

    if (q) {
      const like = `%${q}%`;
      filters.push(
        or(ilike(transactions.descricaoRaw, like), ilike(transactions.detalhe, like))!,
      );
    }

    if (minValue) filters.push(gte(transactions.valor, minValue));
    if (maxValue) filters.push(lte(transactions.valor, maxValue));

    const rows = await db
      .select()
      .from(transactions)
      .where(and(...filters))
      .orderBy(transactions.data);

    const totalEntradas = rows
      .filter((r) => Number(r.valor) > 0)
      .reduce((acc, r) => acc + Number(r.valor), 0);
    const totalSaidas = rows
      .filter((r) => Number(r.valor) < 0)
      .reduce((acc, r) => acc + Number(r.valor), 0);

    return {
      itens: rows.map((r) => ({
        ...r,
        data: r.data as unknown as string,
        importadoEm: r.importadoEm.toISOString(),
      })),
      resumo: {
        totalEntradas: totalEntradas.toFixed(2),
        totalSaidas: totalSaidas.toFixed(2),
        saldo: (totalEntradas + totalSaidas).toFixed(2),
        qtd: rows.length,
      },
    };
  });

  app.post("/transactions", async (req, reply) => {
    const user = await requireUser(req, reply);
    const parsed = TransactionCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const d = parsed.data;
    const importId = await getOrCreateManualImportId(user.id);
    const identificador = crypto.randomUUID();
    const chave = chaveAgrupamento(d.tipo, d.detalhe);
    const [created] = await db
      .insert(transactions)
      .values({
        identificador,
        userId: user.id,
        importId,
        data: d.data,
        valor: d.valor,
        descricaoRaw: d.detalhe ? `${d.tipo} - ${d.detalhe}` : d.tipo,
        tipo: d.tipo,
        detalhe: d.detalhe,
        chaveNormalizada: chave,
        categoriaId: d.categoriaId,
        categoryRuleId: null,
        regraAplicada: "manual",
        observacao: d.observacao ?? null,
      })
      .returning();
    return created;
  });

  app.patch<{ Params: { id: string } }>("/transactions/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    const parsed = TransactionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const updates: Record<string, unknown> = {};
    if (parsed.data.categoriaId) {
      updates.categoriaId = parsed.data.categoriaId;
      updates.categoryRuleId = null;
      updates.regraAplicada = "manual";
    }

    const [current] = await db
      .select({ tipo: transactions.tipo, detalhe: transactions.detalhe })
      .from(transactions)
      .where(and(eq(transactions.userId, user.id), eq(transactions.identificador, req.params.id)));
    if (!current) return reply.code(404).send({ error: "Nao encontrada" });

    let novoTipo = current.tipo;
    let novoDetalhe = current.detalhe;
    let tipoOrDetalheChanged = false;

    if (parsed.data.detalhe !== undefined) {
      updates.detalhe = parsed.data.detalhe;
      novoDetalhe = parsed.data.detalhe;
      tipoOrDetalheChanged = true;
    }
    if (parsed.data.tipo !== undefined) {
      updates.tipo = parsed.data.tipo;
      novoTipo = parsed.data.tipo;
      tipoOrDetalheChanged = true;
    }
    if (tipoOrDetalheChanged) {
      updates.chaveNormalizada = chaveAgrupamento(novoTipo, novoDetalhe);
      updates.descricaoRaw = novoDetalhe ? `${novoTipo} - ${novoDetalhe}` : novoTipo;
    }

    if (parsed.data.data !== undefined) updates.data = parsed.data.data;
    if (parsed.data.valor !== undefined) updates.valor = parsed.data.valor;
    if (parsed.data.observacao !== undefined) updates.observacao = parsed.data.observacao;
    if (!Object.keys(updates).length) return reply.code(400).send({ error: "Sem mudancas" });

    const [updated] = await db
      .update(transactions)
      .set(updates)
      .where(and(eq(transactions.userId, user.id), eq(transactions.identificador, req.params.id)))
      .returning();
    if (!updated) return reply.code(404).send({ error: "Nao encontrada" });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/transactions/:id", async (req, reply) => {
    const user = await requireUser(req, reply);
    const [removed] = await db
      .delete(transactions)
      .where(and(eq(transactions.userId, user.id), eq(transactions.identificador, req.params.id)))
      .returning({ id: transactions.identificador });
    if (!removed) return reply.code(404).send({ error: "Nao encontrada" });
    return { ok: true, id: removed.id };
  });

  app.get("/transactions/tipos", async (req, reply) => {
    const user = await requireUser(req, reply);
    const baseline = [
      "AplicaÃ§Ã£o RDB",
      "Compra no dÃ©bito",
      "DÃ©bito em conta",
      "Estorno",
      "Pagamento de boleto efetuado",
      "Pagamento de fatura",
      "Reembolso recebido pelo Pix",
      "Resgate RDB",
      "Saque",
      "TransferÃªncia enviada pelo Pix",
      "TransferÃªncia Recebida",
      "TransferÃªncia recebida pelo Pix",
    ];
    const rows = await db
      .selectDistinct({ tipo: transactions.tipo })
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .orderBy(transactions.tipo);
    const set = new Set<string>(baseline);
    for (const r of rows) if (r.tipo) set.add(r.tipo);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  });

  app.get("/transactions/summary", async (req, reply) => {
    const user = await requireUser(req, reply);
    const rows = await db
      .select({
        mes: drizzleSql<string>`to_char(${transactions.data}, 'YYYY-MM')`,
        entradas: drizzleSql<string>`coalesce(sum(case when ${transactions.valor} > 0 then ${transactions.valor} end), 0)`,
        saidas: drizzleSql<string>`coalesce(sum(case when ${transactions.valor} < 0 then ${transactions.valor} end), 0)`,
        qtd: drizzleSql<number>`count(*)::int`,
      })
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .groupBy(drizzleSql`to_char(${transactions.data}, 'YYYY-MM')`)
      .orderBy(drizzleSql`to_char(${transactions.data}, 'YYYY-MM') desc`);
    return rows;
  });
}
