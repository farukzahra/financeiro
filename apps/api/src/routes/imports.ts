import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { categories, categoryRules, imports, transactions } from "../db/schema.js";
import { extractFileMetadata, parseCsv } from "../services/parser.js";
import { categorizeAll, type CategoryRuleLite } from "../services/categorizer.js";
import { ConfirmRequestSchema } from "@financeiro/shared";
import { requireUser } from "../auth.js";

export async function registerImportsRoutes(app: FastifyInstance) {
  // POST /imports/preview (multipart) -> { metadata, itens[] }
  app.post("/imports/preview", async (req, reply) => {
    const user = await requireUser(req, reply);
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: "Arquivo obrigatorio" });

    const buffer = await data.toBuffer();
    let metadata;
    try {
      metadata = extractFileMetadata(data.filename, buffer);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }

    const existingImport = await db.query.imports.findFirst({
      where: and(eq(imports.userId, user.id), eq(imports.hashSha256, metadata.hashSha256)),
    });

    const rows = parseCsv(buffer);

    const allRules = await db.query.categoryRules.findMany({
      where: and(eq(categoryRules.userId, user.id), eq(categoryRules.ativa, true)),
    });
    const allCategories = await db.query.categories.findMany();
    const catIds = new Set(allCategories.map((c) => c.id));
    const lite: CategoryRuleLite[] = allRules.map((r) => ({
      id: r.id,
      categoriaId: r.categoriaId,
      tipoPadrao: r.tipoPadrao as "substring" | "regex",
      padrao: r.padrao,
      prioridade: r.prioridade,
    }));

    const categorizados = categorizeAll(rows, lite, catIds);

    const ids = rows.map((r) => r.identificador);
    const existentes = ids.length
      ? await db
          .select({ id: transactions.identificador })
          .from(transactions)
          .where(and(eq(transactions.userId, user.id), inArray(transactions.identificador, ids)))
      : [];
    const existentesSet = new Set(existentes.map((e) => e.id));

    return {
      metadata: {
        ...metadata,
        totalLinhas: rows.length,
        jaImportadoEm: existingImport ? existingImport.criadoEm.toISOString() : null,
      },
      itens: categorizados.map((c) => ({
        identificador: c.identificador,
        data: c.data,
        valor: c.valor,
        descricaoRaw: c.descricaoRaw,
        tipo: c.tipo,
        detalhe: c.detalhe,
        chaveNormalizada: c.chaveNormalizada,
        categoriaSugerida: c.categoriaSugerida,
        categoryRuleId: c.categoryRuleId,
        regraAplicada: c.regraAplicada,
        jaExistente: existentesSet.has(c.identificador),
      })),
    };
  });

  // POST /imports/confirm
  app.post("/imports/confirm", async (req, reply) => {
    const user = await requireUser(req, reply);
    const parsed = ConfirmRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const { metadata, itens } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [imp] = await tx
        .insert(imports)
        .values({
          nomeArquivo: metadata.nomeArquivo,
          userId: user.id,
          hashSha256: metadata.hashSha256,
          conta: metadata.conta,
          periodoInicio: metadata.periodoInicio,
          periodoFim: metadata.periodoFim,
          totalLinhas: metadata.totalLinhas,
        })
        .returning();

      let inseridas = 0;
      let duplicadas = 0;
      for (const it of itens) {
        const res = await tx
          .insert(transactions)
          .values({
            identificador: it.identificador,
            userId: user.id,
            importId: imp.id,
            data: it.data,
            valor: it.valor,
            descricaoRaw: it.descricaoRaw,
            tipo: it.tipo,
            detalhe: it.detalhe,
            chaveNormalizada: it.chaveNormalizada,
            categoriaId: it.categoriaId,
            categoryRuleId: it.categoryRuleId,
            regraAplicada: it.regraAplicada,
          })
          .onConflictDoNothing({
            target: [transactions.userId, transactions.identificador],
          })
          .returning({ id: transactions.identificador });
        if (res.length) inseridas++;
        else duplicadas++;
      }

      const totais = {
        totalLinhas: metadata.totalLinhas,
        totalNovas: itens.length,
        totalDuplicadas: duplicadas,
        totalImportadas: inseridas,
      };

      await tx.update(imports).set(totais).where(eq(imports.id, imp.id));

      return { importId: imp.id, ...totais };
    });

    return result;
  });
}
