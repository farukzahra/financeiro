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

export function categoryDisplayName(categoryId: string): string {
  return CATEGORY_LABELS[categoryId] ?? categoryId;
}

export function categoryOptionLabel(category: Category): string {
  return categoryDisplayName(category.id);
}
