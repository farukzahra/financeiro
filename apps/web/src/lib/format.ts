export function fmtMoneyBR(valor: string | number): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDateBR(yyyyMmDd: string): string {
  if (!yyyyMmDd) return "";
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}

export function classMoney(valor: string | number): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (n > 0) return "money-pos money-cell";
  if (n < 0) return "money-neg money-cell";
  return "money-cell";
}
