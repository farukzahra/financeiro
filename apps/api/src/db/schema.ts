import {
  pgTable,
  text,
  uuid,
  date,
  timestamp,
  boolean,
  integer,
  numeric,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const categories = pgTable("category", {
  id: text("id").primaryKey(),
  letra: text("letra").notNull(),
  descricao: text("descricao").notNull(),
  ativa: boolean("ativa").notNull().default(true),
});

export const categoryRules = pgTable(
  "category_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoriaId: text("categoria_id")
      .notNull()
      .references(() => categories.id),
    tipoPadrao: text("tipo_padrao").notNull(), // 'substring' | 'regex'
    padrao: text("padrao").notNull(),
    prioridade: integer("prioridade").notNull().default(100),
    ativa: boolean("ativa").notNull().default(true),
  },
  (t) => ({
    ativaPrioridade: index("idx_rule_ativa_prioridade").on(t.ativa, t.prioridade),
  }),
);

export const imports = pgTable("import", {
  id: uuid("id").primaryKey().defaultRandom(),
  nomeArquivo: text("nome_arquivo").notNull(),
  hashSha256: text("hash_sha256").notNull(),
  conta: text("conta").notNull(),
  periodoInicio: date("periodo_inicio").notNull(),
  periodoFim: date("periodo_fim").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  totalLinhas: integer("total_linhas").notNull().default(0),
  totalNovas: integer("total_novas").notNull().default(0),
  totalDuplicadas: integer("total_duplicadas").notNull().default(0),
  totalImportadas: integer("total_importadas").notNull().default(0),
});

export const transactions = pgTable(
  "transaction",
  {
    identificador: text("identificador").primaryKey(), // UUID Nubank
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id),
    data: date("data").notNull(),
    valor: numeric("valor", { precision: 14, scale: 2 }).notNull(),
    descricaoRaw: text("descricao_raw").notNull(),
    tipo: text("tipo").notNull(),
    detalhe: text("detalhe").notNull().default(""),
    chaveNormalizada: text("chave_normalizada").notNull(),
    categoriaId: text("categoria_id")
      .notNull()
      .references(() => categories.id),
    categoryRuleId: uuid("category_rule_id").references(() => categoryRules.id),
    regraAplicada: text("regra_aplicada").notNull(),
    importadoEm: timestamp("importado_em", { withTimezone: true }).notNull().defaultNow(),
    observacao: text("observacao"),
  },
  (t) => ({
    dataIdx: index("idx_tx_data").on(t.data),
    catDataIdx: index("idx_tx_cat_data").on(t.categoriaId, t.data),
    chaveIdx: index("idx_tx_chave").on(t.chaveNormalizada),
  }),
);
