/** Tipos comuns em extratos Nubank (UTF-8), usados como sugestões no combobox. */
export const BASELINE_TRANSACTION_TIPOS = [
  "Aplicação RDB",
  "Compra no débito",
  "Débito em conta",
  "Estorno",
  "Pagamento de boleto efetuado",
  "Pagamento de fatura",
  "Reembolso recebido pelo Pix",
  "Resgate RDB",
  "Saque",
  "Transferência enviada pelo Pix",
  "Transferência Recebida",
  "Transferência recebida pelo Pix",
] as const;

export function mergeTransactionTipos(baseline: readonly string[], fromDb: string[]): string[] {
  const set = new Set<string>(baseline);
  for (const tipo of fromDb) {
    if (tipo) set.add(tipo);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
