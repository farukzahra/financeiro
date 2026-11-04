export type DashboardCategory = {
  categoriaId: string;
  code: string;
  descricao: string;
  entradas: string;
  saidas: string;
  qtd: number;
};

export type DashboardMonth = {
  month: number;
  mes: string;
  entradas: string;
  saidas: string;
  saldo: string;
  qtd: number;
  categorias: DashboardCategory[];
};

export type DashboardTotals = {
  entradas: string;
  saidas: string;
  saldo: string;
  qtd: number;
  mesesComSaidas: number;
  mediaSaidas: string;
};

export type DashboardGastoMes = {
  month: number;
  mes: string;
  saidas: string;
};

export type Dashboard = {
  year: number;
  months: DashboardMonth[];
  totals: DashboardTotals;
  categorias: DashboardCategory[];
  maiorGastoMes: DashboardGastoMes | null;
  maiorCategoria: DashboardCategory | null;
};

export type DashboardSourceRow = {
  month: number;
  categoriaId: string;
  code: string;
  descricao: string;
  entradas: string | number;
  saidas: string | number;
  qtd: number;
};

type Acc = {
  entradas: number;
  saidas: number;
  qtd: number;
};

type CatAcc = Acc & {
  categoriaId: string;
  code: string;
  descricao: string;
};

function toCents(value: string | number): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function toMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

function formatCents(cents: number): string {
  return toMoney(cents);
}

function sortCategories(categories: CatAcc[]): DashboardCategory[] {
  return categories
    .slice()
    .sort(
      (a, b) =>
        Math.abs(b.saidas) - Math.abs(a.saidas) ||
        b.entradas - a.entradas ||
        a.descricao.localeCompare(b.descricao, "pt-BR"),
    )
    .map((cat) => ({
      categoriaId: cat.categoriaId,
      code: cat.code,
      descricao: cat.descricao,
      entradas: formatCents(cat.entradas),
      saidas: formatCents(cat.saidas),
      qtd: cat.qtd,
    }));
}

function addCategory(
  map: Map<string, CatAcc>,
  row: DashboardSourceRow,
  entradas: number,
  saidas: number,
): void {
  const current = map.get(row.categoriaId);
  if (current) {
    current.entradas += entradas;
    current.saidas += saidas;
    current.qtd += row.qtd;
    return;
  }
  map.set(row.categoriaId, {
    categoriaId: row.categoriaId,
    code: row.code,
    descricao: row.descricao,
    entradas,
    saidas,
    qtd: row.qtd,
  });
}

export function buildDashboard(year: number, rows: DashboardSourceRow[]): Dashboard {
  const monthTotals: Acc[] = Array.from({ length: 12 }, () => ({
    entradas: 0,
    saidas: 0,
    qtd: 0,
  }));
  const monthCategories: Map<string, CatAcc>[] = Array.from(
    { length: 12 },
    () => new Map<string, CatAcc>(),
  );
  const yearCategories = new Map<string, CatAcc>();

  for (const row of rows) {
    if (!Number.isInteger(row.month) || row.month < 1 || row.month > 12) continue;
    const index = row.month - 1;
    const entradas = toCents(row.entradas);
    const saidas = toCents(row.saidas);
    const qtd = Number.isFinite(row.qtd) ? row.qtd : 0;

    monthTotals[index].entradas += entradas;
    monthTotals[index].saidas += saidas;
    monthTotals[index].qtd += qtd;

    addCategory(monthCategories[index], row, entradas, saidas);
    addCategory(yearCategories, row, entradas, saidas);
  }

  const months: DashboardMonth[] = monthTotals.map((total, index) => ({
    month: index + 1,
    mes: `${year}-${String(index + 1).padStart(2, "0")}`,
    entradas: toMoney(total.entradas),
    saidas: toMoney(total.saidas),
    saldo: toMoney(total.entradas + total.saidas),
    qtd: total.qtd,
    categorias: sortCategories([...monthCategories[index].values()]),
  }));

  const totals = months.reduce(
    (acc, month) => ({
      entradas: acc.entradas + toCents(month.entradas),
      saidas: acc.saidas + toCents(month.saidas),
      qtd: acc.qtd + month.qtd,
      mesesComSaidas: acc.mesesComSaidas + (toCents(month.saidas) < 0 ? 1 : 0),
    }),
    { entradas: 0, saidas: 0, qtd: 0, mesesComSaidas: 0 },
  );

  const mesComMaiorGasto = months
    .filter((month) => toCents(month.saidas) < 0)
    .sort((a, b) => toCents(a.saidas) - toCents(b.saidas))[0];
  const categorias = sortCategories([...yearCategories.values()]);
  const maiorCategoria = categorias.find((cat) => toCents(cat.saidas) < 0) ?? null;

  return {
    year,
    months,
    totals: {
      entradas: toMoney(totals.entradas),
      saidas: toMoney(totals.saidas),
      saldo: toMoney(totals.entradas + totals.saidas),
      qtd: totals.qtd,
      mesesComSaidas: totals.mesesComSaidas,
      mediaSaidas:
        totals.mesesComSaidas > 0
          ? toMoney(totals.saidas / totals.mesesComSaidas)
          : "0.00",
    },
    categorias,
    maiorGastoMes: mesComMaiorGasto
      ? {
          month: mesComMaiorGasto.month,
          mes: mesComMaiorGasto.mes,
          saidas: mesComMaiorGasto.saidas,
        }
      : null,
    maiorCategoria,
  };
}
