import {
  pgTable,
  text,
  uuid,
  date,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "app_user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    googleSub: text("google_sub").notNull(),
    passwordHash: text("password_hash"),
    role: text("role").notNull().default("user"),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("idx_user_email_unique").on(t.email),
    googleSubUnique: uniqueIndex("idx_user_google_sub_unique").on(t.googleSub),
  }),
);

export const categories = pgTable("category", {
  id: text("id").primaryKey(),
  descricao: text("descricao").notNull(),
  ativa: boolean("ativa").notNull().default(true),
});

export const categoryRules = pgTable(
  "category_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    categoriaId: text("categoria_id")
      .notNull()
      .references(() => categories.id),
    tipoPadrao: text("tipo_padrao").notNull(), // 'substring' | 'regex'
    padrao: text("padrao").notNull(),
    prioridade: integer("prioridade").notNull().default(100),
    ativa: boolean("ativa").notNull().default(true),
  },
  (t) => ({
    userAtivaPrioridade: index("idx_rule_user_ativa_prioridade").on(
      t.userId,
      t.ativa,
      t.prioridade,
    ),
  }),
);

export const imports = pgTable("import", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
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
    identificador: text("identificador").notNull(), // UUID Nubank
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
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
    pk: primaryKey({ columns: [t.userId, t.identificador] }),
    userDataIdx: index("idx_tx_user_data").on(t.userId, t.data),
    userCatDataIdx: index("idx_tx_user_cat_data").on(t.userId, t.categoriaId, t.data),
    userChaveIdx: index("idx_tx_user_chave").on(t.userId, t.chaveNormalizada),
  }),
);

export const budgetItems = pgTable("budget_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  descricao: text("descricao").notNull(),
  categoriaId: text("categoria_id").references(() => categories.id),
  diaVencimento: integer("dia_vencimento"),
  valorMensal: numeric("valor_mensal", { precision: 14, scale: 2 }).notNull(),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});
