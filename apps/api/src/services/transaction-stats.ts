export type MonthStat = {
  month: number;
  mes: string;
  qtd: number;
};

export function buildYearMonthStats(
  year: number,
  countsByMonth: Partial<Record<number, number>>,
): MonthStat[] {
  const result: MonthStat[] = [];
  for (let month = 1; month <= 12; month++) {
    const mes = `${year}-${String(month).padStart(2, "0")}`;
    result.push({
      month,
      mes,
      qtd: countsByMonth[month] ?? 0,
    });
  }
  return result;
}

export function sumMonthStats(months: MonthStat[]): number {
  return months.reduce((acc, row) => acc + row.qtd, 0);
}

export function parseStatsYear(value: string | undefined): number | null {
  if (value == null || value === "") return new Date().getFullYear();
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year) || year < 1970 || year > 2100) return null;
  return year;
}
