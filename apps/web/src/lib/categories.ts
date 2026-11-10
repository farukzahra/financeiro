import type { Category } from "./api";

const CATEGORY_LABELS: Record<string, string> = {
  ALIMENTAÇÃO: "ALIMENTAÇÃO",
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
  "CARTAO DE CREDITO": "CARTÃO DE CRÉDITO",
  SALARIO: "SALÁRIO",
  SAQUE: "SAQUE",
  OUTROS: "OUTROS",
};

const CATEGORY_DOT_COLORS: Record<string, string> = {
  "ALIMENTAÇÃO": "#4f8a3d",
  ALIMENTACAO: "#4f8a3d",
  FARMACIA: "#2f7f7a",
  SAUDE: "#2e7fb8",
  GASOLINA: "#c58a1a",
  TRANSPORTE: "#4c6fb3",
  COMPRAS: "#b65e8e",
  AGRO: "#6a8f2f",
  VIAGEM: "#7a5bb5",
  ACADEMIA: "#c4692f",
  PIX: "#2f9bb3",
  "APLICACAO RDB": "#245e9e",
  "RESGATE RDB": "#557c9e",
  "FATURA GENERICA": "#b4535f",
  "DEBITO EM CONTA": "#6b7280",
  "CARTAO DE CREDITO": "#8b5bb5",
  SALARIO: "#2f8f5b",
  SAQUE: "#8f6b4a",
  OUTROS: "#7c8494",
};

export function categoryDotColor(
  categoryId: string,
  catalog?: Category[],
): string {
  const code = categoryCode(categoryId, catalog).toUpperCase();
  const hit = CATEGORY_DOT_COLORS[code];
  if (hit) return hit;

  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 52% 42%)`;
}

function findCategory(categoryId: string, catalog?: Category[]): Category | undefined {
  return catalog?.find((c) => c.id === categoryId || c.code === categoryId);
}

export function categoryDisplayName(categoryId: string, catalog?: Category[]): string {
  const hit = findCategory(categoryId, catalog);
  if (hit) return hit.descricao || hit.code;
  return CATEGORY_LABELS[categoryId] ?? categoryId;
}

export function categoryPillLabel(categoryId: string, catalog?: Category[]): string {
  const hit = findCategory(categoryId, catalog);
  if (hit) return CATEGORY_LABELS[hit.code] ?? hit.code;
  return CATEGORY_LABELS[categoryId] ?? categoryId;
}

export function categoryOptionLabel(category: Category): string {
  return category.descricao || categoryDisplayName(category.code, [category]);
}

export function categoryCode(categoryId: string, catalog?: Category[]): string {
  return findCategory(categoryId, catalog)?.code ?? categoryId;
}
