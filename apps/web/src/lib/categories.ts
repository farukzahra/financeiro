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

const CATEGORY_PILL_COLORS: Record<string, string> = {
  "ALIMENTAÇÃO": "#22c55e",
  ALIMENTACAO: "#22c55e",
  FARMACIA: "#14b8a6",
  SAUDE: "#0ea5e9",
  GASOLINA: "#f59e0b",
  TRANSPORTE: "#6366f1",
  COMPRAS: "#d946ef",
  AGRO: "#84cc16",
  VIAGEM: "#8b5cf6",
  ACADEMIA: "#f97316",
  PIX: "#06b6d4",
  "APLICACAO RDB": "#3b82f6",
  "RESGATE RDB": "#fb7185",
  "FATURA GENERICA": "#ef4444",
  "DEBITO EM CONTA": "#cbd5e1",
  "CARTAO DE CREDITO": "#a855f7",
  SALARIO: "#10b981",
  SAQUE: "#eab308",
  OUTROS: "#64748b",
};

export function categoryPillColor(
  categoryId: string,
  catalog?: Category[],
): string {
  const code = categoryCode(categoryId, catalog).toUpperCase();
  const hit = CATEGORY_PILL_COLORS[code];
  if (hit) return hit;

  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 65% 48%)`;
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
