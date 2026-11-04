import { describe, expect, it } from "vitest";
import { buildDashboard, type DashboardSourceRow } from "./dashboard.js";

function row(overrides: Partial<DashboardSourceRow>): DashboardSourceRow {
  return {
    month: 1,
    categoriaId: "cat-1",
    code: "ALIMENTACAO",
    descricao: "Alimentação",
    entradas: "0.00",
    saidas: "0.00",
    qtd: 0,
    ...overrides,
  };
}

describe("buildDashboard", () => {
  it("returns all 12 months even when there is no data", () => {
    const dashboard = buildDashboard(2026, []);
    expect(dashboard.months).toHaveLength(12);
    expect(dashboard.months.map((month) => month.mes)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    expect(dashboard.months.every((month) => month.qtd === 0)).toBe(true);
    expect(dashboard.totals).toEqual({
      entradas: "0.00",
      saidas: "0.00",
      saldo: "0.00",
      qtd: 0,
      mesesComSaidas: 0,
      mediaSaidas: "0.00",
    });
    expect(dashboard.maiorGastoMes).toBeNull();
    expect(dashboard.maiorCategoria).toBeNull();
  });

  it("aggregates entries and exits per month and for the year", () => {
    const dashboard = buildDashboard(2026, [
      row({ month: 1, entradas: "7450.00", qtd: 1 }),
      row({ month: 1, saidas: "-1200.50", qtd: 3 }),
      row({
        month: 2,
        categoriaId: "cat-2",
        code: "TRANSPORTE",
        descricao: "Transporte",
        saidas: "-300.25",
        qtd: 2,
      }),
      row({
        month: 2,
        categoriaId: "cat-3",
        code: "SALARIO",
        descricao: "Salário",
        entradas: "7450.00",
        qtd: 1,
      }),
    ]);

    const january = dashboard.months[0];
    expect(january.entradas).toBe("7450.00");
    expect(january.saidas).toBe("-1200.50");
    expect(january.saldo).toBe("6249.50");
    expect(january.qtd).toBe(4);

    expect(dashboard.totals.entradas).toBe("14900.00");
    expect(dashboard.totals.saidas).toBe("-1500.75");
    expect(dashboard.totals.saldo).toBe("13399.25");
    expect(dashboard.totals.qtd).toBe(7);
    expect(dashboard.totals.mesesComSaidas).toBe(2);
    expect(dashboard.totals.mediaSaidas).toBe("-750.38");
  });

  it("aggregates categories across months and sorts by biggest exit", () => {
    const dashboard = buildDashboard(2026, [
      row({ month: 1, categoriaId: "food", saidas: "-100.00", qtd: 1 }),
      row({ month: 2, categoriaId: "food", saidas: "-200.00", qtd: 2 }),
      row({
        month: 1,
        categoriaId: "travel",
        code: "VIAGEM",
        descricao: "Viagem",
        saidas: "-900.00",
        qtd: 1,
      }),
      row({
        month: 2,
        categoriaId: "health",
        code: "SAUDE",
        descricao: "Saúde",
        saidas: "-300.00",
        qtd: 1,
      }),
    ]);

    expect(dashboard.categorias.map((cat) => cat.categoriaId)).toEqual([
      "travel",
      "food",
      "health",
    ]);
    const food = dashboard.categorias.find((cat) => cat.categoriaId === "food");
    expect(food).toMatchObject({ saidas: "-300.00", qtd: 3 });
    expect(dashboard.maiorCategoria?.categoriaId).toBe("travel");
  });

  it("finds the month with the biggest exit", () => {
    const dashboard = buildDashboard(2026, [
      row({ month: 3, saidas: "-500.00", qtd: 1 }),
      row({ month: 7, saidas: "-4100.00", qtd: 2 }),
      row({ month: 9, saidas: "-1200.00", qtd: 1 }),
    ]);

    expect(dashboard.maiorGastoMes).toEqual({
      month: 7,
      mes: "2026-07",
      saidas: "-4100.00",
    });
  });

  it("ignores rows with an invalid month", () => {
    const dashboard = buildDashboard(2026, [
      row({ month: 0, saidas: "-100.00", qtd: 1 }),
      row({ month: 13, saidas: "-200.00", qtd: 1 }),
      row({ month: 4, saidas: "-50.00", qtd: 1 }),
    ]);

    expect(dashboard.totals.saidas).toBe("-50.00");
    expect(dashboard.totals.qtd).toBe(1);
  });
});
