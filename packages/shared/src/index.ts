import { z } from "zod";

// ---------------------------------------------------------------------------
// Categorias e regras
// ---------------------------------------------------------------------------

export const CategorySchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  descricao: z.string().min(1),
  ativa: z.boolean(),
});
export type Category = z.infer<typeof CategorySchema>;

export const CategoryCreateSchema = z.object({
  code: z.string().min(1),
  descricao: z.string().min(1),
  ativa: z.boolean().optional().default(true),
});
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;

export const CategoryUpdateSchema = z.object({
  code: z.string().min(1).optional(),
  descricao: z.string().min(1).optional(),
  ativa: z.boolean().optional(),
});
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;

/** @deprecated use CategoryCreateSchema / CategoryUpdateSchema */
export const CategoryUpsertSchema = CategoryCreateSchema;
export type CategoryUpsert = z.infer<typeof CategoryUpsertSchema>;

export const RuleTypeSchema = z.enum(["substring", "regex"]);
export type RuleType = z.infer<typeof RuleTypeSchema>;

export const CategoryRuleSchema = z.object({
  id: z.string().uuid(),
  categoriaId: z.string().uuid(),
  tipoPadrao: RuleTypeSchema,
  padrao: z.string().min(1),
  prioridade: z.number().int(),
  ativa: z.boolean(),
});
export type CategoryRule = z.infer<typeof CategoryRuleSchema>;

export const CategoryRuleCreateSchema = CategoryRuleSchema.omit({ id: true }).extend({
  ativa: z.boolean().optional().default(true),
  prioridade: z.number().int().optional().default(100),
});
export type CategoryRuleCreate = z.infer<typeof CategoryRuleCreateSchema>;

// ---------------------------------------------------------------------------
// Preview e import
// ---------------------------------------------------------------------------

export const PreviewItemSchema = z.object({
  identificador: z.string(),
  data: z.string(), // ISO yyyy-mm-dd
  valor: z.string(), // decimal como string para preservar precisao
  descricaoRaw: z.string(),
  tipo: z.string(),
  detalhe: z.string(),
  chaveNormalizada: z.string(),
  categoriaSugerida: z.string(),
  categoryRuleId: z.string().uuid().nullable(),
  regraAplicada: z.enum(["dicionario", "tipo_automatico", "heuristica", "fallback", "manual"]),
  jaExistente: z.boolean(),
});
export type PreviewItem = z.infer<typeof PreviewItemSchema>;

export const ImportMetadataSchema = z.object({
  nomeArquivo: z.string(),
  hashSha256: z.string(),
  conta: z.string(),
  periodoInicio: z.string(), // yyyy-mm-dd
  periodoFim: z.string(),
  totalLinhas: z.number().int(),
  jaImportadoEm: z.string().nullable(), // ISO datetime
});
export type ImportMetadata = z.infer<typeof ImportMetadataSchema>;

export const PreviewResponseSchema = z.object({
  metadata: ImportMetadataSchema,
  itens: z.array(PreviewItemSchema),
});
export type PreviewResponse = z.infer<typeof PreviewResponseSchema>;

export const PreviewBatchItemSchema = PreviewItemSchema.extend({
  sourceHashSha256: z.string(),
});
export type PreviewBatchItem = z.infer<typeof PreviewBatchItemSchema>;

export const PreviewBatchResponseSchema = z.object({
  sources: z.array(ImportMetadataSchema),
  itens: z.array(PreviewBatchItemSchema),
});
export type PreviewBatchResponse = z.infer<typeof PreviewBatchResponseSchema>;

export const ConfirmItemSchema = z.object({
  identificador: z.string(),
  data: z.string(),
  valor: z.string(),
  descricaoRaw: z.string(),
  tipo: z.string(),
  detalhe: z.string(),
  chaveNormalizada: z.string(),
  categoriaId: z.string().uuid(),
  categoryRuleId: z.string().uuid().nullable(),
  regraAplicada: z.string(),
});
export type ConfirmItem = z.infer<typeof ConfirmItemSchema>;

export const ConfirmRequestSchema = z.object({
  metadata: ImportMetadataSchema,
  itens: z.array(ConfirmItemSchema),
});
export type ConfirmRequest = z.infer<typeof ConfirmRequestSchema>;

export const ConfirmResponseSchema = z.object({
  importId: z.string().uuid(),
  totalLinhas: z.number().int(),
  totalNovas: z.number().int(),
  totalDuplicadas: z.number().int(),
  totalImportadas: z.number().int(),
});
export type ConfirmResponse = z.infer<typeof ConfirmResponseSchema>;

// ---------------------------------------------------------------------------
// Transacoes (consulta)
// ---------------------------------------------------------------------------

export const TransactionSchema = z.object({
  identificador: z.string(),
  importId: z.string().uuid(),
  data: z.string(),
  valor: z.string(),
  descricaoRaw: z.string(),
  tipo: z.string(),
  detalhe: z.string(),
  chaveNormalizada: z.string(),
  categoriaId: z.string().uuid(),
  categoryRuleId: z.string().uuid().nullable(),
  regraAplicada: z.string(),
  importadoEm: z.string(),
  observacao: z.string().nullable(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const TransactionUpdateSchema = z.object({
  categoriaId: z.string().uuid().optional(),
  observacao: z.string().nullable().optional(),
  detalhe: z.string().optional(),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  valor: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/)
    .optional(),
  tipo: z.string().min(1).optional(),
});
export type TransactionUpdate = z.infer<typeof TransactionUpdateSchema>;

export const TransactionCreateSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valor: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  tipo: z.string().min(1),
  detalhe: z.string().default(""),
  categoriaId: z.string().uuid(),
  observacao: z.string().nullable().optional(),
});
export type TransactionCreate = z.infer<typeof TransactionCreateSchema>;

export const TransactionsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  category: z.array(z.string()).optional(),
  q: z.string().optional(),
  minValue: z.string().optional(),
  maxValue: z.string().optional(),
});
export type TransactionsQuery = z.infer<typeof TransactionsQuerySchema>;

// ---------------------------------------------------------------------------
// Categoria salário (desempate na lista por data)
// ---------------------------------------------------------------------------

export const CATEGORY_CODE_SALARIO = "SALARIO" as const;

export function salarioSortRank(categoryCode: string | null | undefined): number {
  return categoryCode === CATEGORY_CODE_SALARIO ? 0 : 1;
}

export function compareTransactionsByDateThenSalario(
  a: {
    data: string;
    categoryCode: string | null | undefined;
    detalhe?: string | null;
  },
  b: {
    data: string;
    categoryCode: string | null | undefined;
    detalhe?: string | null;
  },
  order: 1 | -1,
): number {
  const byDate = a.data.localeCompare(b.data) * order;
  if (byDate !== 0) return byDate;
  const bySalario = salarioSortRank(a.categoryCode) - salarioSortRank(b.categoryCode);
  if (bySalario !== 0) return bySalario;
  return (a.detalhe ?? "").localeCompare(b.detalhe ?? "", "pt-BR");
}

/** Dias atrás do máximo importável (CSV até D-1 = ontem). null se sem data. */
export function csvStaleDays(
  ultimaData: string | null | undefined,
  today: Date = new Date(),
): number | null {
  if (!ultimaData) return null;

  const [y, m, d] = ultimaData.split("-").map(Number);
  if (!y || !m || !d) return null;
  const last = new Date(y, m - 1, d);

  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  end.setDate(end.getDate() - 1);

  const diffDays = Math.round((end.getTime() - last.getTime()) / 86_400_000);
  return Math.max(0, diffDays);
}

// ---------------------------------------------------------------------------
// Orcamento previsto
// ---------------------------------------------------------------------------

export const BUDGET_ORIGEM_ASSINATURAS = "assinaturas" as const;

export const BudgetItemSchema = z.object({
  id: z.string().uuid(),
  descricao: z.string().min(1),
  categoriaId: z.string().uuid().nullable(),
  diaVencimento: z.number().int().min(1).max(31).nullable(),
  valorMensal: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  ativo: z.boolean(),
  origem: z.enum([BUDGET_ORIGEM_ASSINATURAS]).nullable().optional(),
  criadoEm: z.string(),
});
export type BudgetItem = z.infer<typeof BudgetItemSchema>;

export const BudgetItemCreateSchema = z.object({
  descricao: z.string().min(1),
  categoriaId: z.string().uuid().nullable().optional(),
  diaVencimento: z.number().int().min(1).max(31).nullable().optional(),
  valorMensal: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  ativo: z.boolean().optional().default(true),
});
export type BudgetItemCreate = z.infer<typeof BudgetItemCreateSchema>;

export const BudgetItemUpdateSchema = BudgetItemCreateSchema.partial();
export type BudgetItemUpdate = z.infer<typeof BudgetItemUpdateSchema>;

// ---------------------------------------------------------------------------
// Assinaturas
// ---------------------------------------------------------------------------

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1),
  valorMensal: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  criadoEm: z.string(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

export const SubscriptionCreateSchema = z.object({
  nome: z.string().min(1),
  valorMensal: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
});
export type SubscriptionCreate = z.infer<typeof SubscriptionCreateSchema>;

export const SubscriptionUpdateSchema = SubscriptionCreateSchema.partial();
export type SubscriptionUpdate = z.infer<typeof SubscriptionUpdateSchema>;
