import { describe, expect, it } from "vitest";
import { buildTransactionsResumo, sumSaldo } from "./transaction-resumo.js";

describe("sumSaldo", () => {
  it("sums all values including negatives", () => {
    expect(sumSaldo([{ valor: "100" }, { valor: "-30" }, { valor: "-20.5" }])).toBe(49.5);
  });

  it("returns 0 for empty list", () => {
    expect(sumSaldo([])).toBe(0);
  });
});

describe("buildTransactionsResumo", () => {
  it("uses filtered rows for entradas/saidas/qtd but all-time saldo", () => {
    const filtered = [{ valor: "-50" }, { valor: "10" }];
    const allTimeSaldo = sumSaldo([
      { valor: "1000" },
      { valor: "-50" },
      { valor: "10" },
      { valor: "-200" },
    ]);

    expect(buildTransactionsResumo(filtered, allTimeSaldo)).toEqual({
      totalEntradas: "10.00",
      totalSaidas: "-50.00",
      saldo: "760.00",
      qtd: 2,
    });
  });

  it("keeps all-time saldo when filtered period has no rows", () => {
    expect(buildTransactionsResumo([], 1234.56)).toEqual({
      totalEntradas: "0.00",
      totalSaidas: "0.00",
      saldo: "1234.56",
      qtd: 0,
    });
  });
});
