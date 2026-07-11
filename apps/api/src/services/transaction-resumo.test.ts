import { describe, expect, it } from "vitest";
import { csvStaleDays } from "@financeiro/shared";
import { buildTransactionsResumo, sumSaldo } from "./transaction-resumo.js";

describe("sumSaldo", () => {
  it("sums all values including negatives", () => {
    expect(sumSaldo([{ valor: "100" }, { valor: "-30" }, { valor: "-20.5" }])).toBe(49.5);
  });

  it("returns 0 for empty list", () => {
    expect(sumSaldo([])).toBe(0);
  });
});

describe("csvStaleDays", () => {
  it("hoje 11 e última 8 → 2 dias (esperado até D-1=10)", () => {
    expect(csvStaleDays("2026-07-08", new Date(2026, 6, 11))).toBe(2);
  });

  it("última = ontem → 0", () => {
    expect(csvStaleDays("2026-07-10", new Date(2026, 6, 11))).toBe(0);
  });

  it("última = anteontem → 1", () => {
    expect(csvStaleDays("2026-07-09", new Date(2026, 6, 11))).toBe(1);
  });

  it("sem data → null", () => {
    expect(csvStaleDays(null, new Date(2026, 6, 11))).toBeNull();
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

    expect(buildTransactionsResumo(filtered, allTimeSaldo, "2026-07-08")).toEqual({
      totalEntradas: "10.00",
      totalSaidas: "-50.00",
      saldo: "760.00",
      qtd: 2,
      ultimaData: "2026-07-08",
    });
  });

  it("keeps all-time saldo when filtered period has no rows", () => {
    expect(buildTransactionsResumo([], 1234.56, null)).toEqual({
      totalEntradas: "0.00",
      totalSaidas: "0.00",
      saldo: "1234.56",
      qtd: 0,
      ultimaData: null,
    });
  });
});
