import type { Category } from "./api";

const CATEGORY_LABELS: Record<string, string> = {
  ALIMENTACAO: "ALIMENTAÇÃO",
  FARMACIA: "FARMÁCIA",
  SAUDE: "SAÚDE",
  GASOLINA: "GASOLINA",
  TRANSPORTE: "TRANSPORTE",
  COMPRAS: "COMPRAS",
  AGRO: "AGRO",
  VIAGEM: "VIAGEM",
  ACADEMIA: "ACADEMIA",
  PIX: "PIX",
  "APLICACAO RDB": "APLICAÇÃO RDB",
  "RESGATE RDB": "RESGATE RDB",
  "FATURA GENERICA": "FATURA GENÉRICA",
  "DEBITO EM CONTA": "DÉBITO EM CONTA",
  SAQUE: "SAQUE",
  OUTROS: "OUTROS",
};

function findCategory(categoryId: string, catalog?: Category[]): Category | undefined {
  return catalog?.find((c) => c.id === categoryId || c.code === categoryId);
}

export function categoryDisplayName(categoryId: string, catalog?: Category[]): string {
  const hit = findCategory(categoryId, catalog);
  if (hit) return hit.descricao || hit.code;
  return CATEGORY_LABELS[categoryId] ?? categoryId;
}

export function categoryOptionLabel(category: Category): string {
  return category.descricao || categoryDisplayName(category.code, [category]);
}

export function categoryCode(categoryId: string, catalog?: Category[]): string {
  return findCategory(categoryId, catalog)?.code ?? categoryId;
}
