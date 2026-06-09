import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

export type Category = {
  id: string;
  letra: string;
  descricao: string;
  ativa: boolean;
};

export type CategoryRule = {
  id: string;
  categoriaId: string;
  tipoPadrao: "substring" | "regex";
  padrao: string;
  prioridade: number;
  ativa: boolean;
};

export type PreviewItem = {
  identificador: string;
  data: string;
  valor: string;
  descricaoRaw: string;
  tipo: string;
  detalhe: string;
  chaveNormalizada: string;
  categoriaSugerida: string;
  categoryRuleId: string | null;
  regraAplicada: string;
  jaExistente: boolean;
};

export type ImportMetadata = {
  nomeArquivo: string;
  hashSha256: string;
  conta: string;
  periodoInicio: string;
  periodoFim: string;
  totalLinhas: number;
  jaImportadoEm: string | null;
};

export type PreviewResponse = {
  metadata: ImportMetadata;
  itens: PreviewItem[];
};

export type Transaction = {
  identificador: string;
  importId: string;
  data: string;
  valor: string;
  descricaoRaw: string;
  tipo: string;
  detalhe: string;
  chaveNormalizada: string;
  categoriaId: string;
  categoryRuleId: string | null;
  regraAplicada: string;
  importadoEm: string;
  observacao: string | null;
};

export type TransactionsResponse = {
  itens: Transaction[];
  resumo: {
    totalEntradas: string;
    totalSaidas: string;
    saldo: string;
    qtd: number;
  };
};

export async function preview(file: File): Promise<PreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<PreviewResponse>("/imports/preview", form);
  return data;
}

export async function confirmImport(payload: {
  metadata: ImportMetadata;
  itens: Array<{
    identificador: string;
    data: string;
    valor: string;
    descricaoRaw: string;
    tipo: string;
    detalhe: string;
    chaveNormalizada: string;
    categoriaId: string;
    categoryRuleId: string | null;
    regraAplicada: string;
  }>;
}) {
  const { data } = await api.post("/imports/confirm", payload);
  return data as {
    importId: string;
    totalLinhas: number;
    totalNovas: number;
    totalDuplicadas: number;
    totalImportadas: number;
  };
}

export async function listCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>("/categories");
  return data;
}

export async function listRules(): Promise<CategoryRule[]> {
  const { data } = await api.get<CategoryRule[]>("/rules");
  return data;
}

export async function listTransactions(params: {
  from?: string;
  to?: string;
  category?: string[];
  q?: string;
}): Promise<TransactionsResponse> {
  const { data } = await api.get<TransactionsResponse>("/transactions", {
    params,
    paramsSerializer: { indexes: null },
  });
  return data;
}

export async function patchTransaction(
  id: string,
  body: {
    categoriaId?: string;
    observacao?: string | null;
    detalhe?: string;
    data?: string;
    valor?: string;
    tipo?: string;
  },
): Promise<Transaction> {
  const { data } = await api.patch<Transaction>(`/transactions/${id}`, body);
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/transactions/${id}`);
}

export async function createTransaction(body: {
  data: string;
  valor: string;
  tipo: string;
  detalhe: string;
  categoriaId: string;
  observacao?: string | null;
}): Promise<Transaction> {
  const { data } = await api.post<Transaction>("/transactions", body);
  return data;
}

export async function listTipos(): Promise<string[]> {
  const { data } = await api.get<string[]>("/transactions/tipos");
  return data;
}

export async function createRule(body: {
  categoriaId: string;
  tipoPadrao: "substring" | "regex";
  padrao: string;
  prioridade?: number;
  ativa?: boolean;
}) {
  const { data } = await api.post<CategoryRule>("/rules", body);
  return data;
}

export async function previewRule(padrao: string, tipo: "substring" | "regex") {
  const { data } = await api.get<{ chaves: { chave: string; qtd: number }[] }>(
    "/rules/preview",
    { params: { padrao, tipo } },
  );
  return data;
}

// ---------------------------------------------------------------------------
// Orcamento previsto
// ---------------------------------------------------------------------------

export type BudgetItem = {
  id: string;
  descricao: string;
  categoriaId: string | null;
  diaVencimento: number | null;
  valorMensal: string;
  ativo: boolean;
  criadoEm: string;
};

export async function listBudget(): Promise<BudgetItem[]> {
  const { data } = await api.get<BudgetItem[]>("/budget");
  return data;
}

export async function createBudgetItem(body: {
  descricao: string;
  categoriaId?: string | null;
  diaVencimento?: number | null;
  valorMensal: string;
  ativo?: boolean;
}): Promise<BudgetItem> {
  const { data } = await api.post<BudgetItem>("/budget", body);
  return data;
}

export async function patchBudgetItem(
  id: string,
  body: Partial<{
    descricao: string;
    categoriaId: string | null;
    diaVencimento: number | null;
    valorMensal: string;
    ativo: boolean;
  }>,
): Promise<BudgetItem> {
  const { data } = await api.patch<BudgetItem>(`/budget/${id}`, body);
  return data;
}

export async function deleteBudgetItem(id: string): Promise<void> {
  await api.delete(`/budget/${id}`);
}
