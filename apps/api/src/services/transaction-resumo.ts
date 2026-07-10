/** Period totals from filtered rows; saldo atual is always all-time. */
export function buildTransactionsResumo(
  filteredRows: Array<{ valor: string | number }>,
  allTimeSaldo: number,
) {
  let totalEntradas = 0;
  let totalSaidas = 0;
  for (const r of filteredRows) {
    const v = Number(r.valor);
    if (v > 0) totalEntradas += v;
    else if (v < 0) totalSaidas += v;
  }
  return {
    totalEntradas: totalEntradas.toFixed(2),
    totalSaidas: totalSaidas.toFixed(2),
    saldo: allTimeSaldo.toFixed(2),
    qtd: filteredRows.length,
  };
}

export function sumSaldo(rows: Array<{ valor: string | number }>): number {
  return rows.reduce((acc, r) => acc + Number(r.valor), 0);
}
