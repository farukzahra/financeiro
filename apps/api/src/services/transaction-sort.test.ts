import { describe, expect, it } from "vitest";
import {
  CATEGORY_CODE_SALARIO,
  compareTransactionsByDateThenSalario,
  salarioSortRank,
} from "@financeiro/shared";

describe("salarioSortRank", () => {
  it("prioriza SALARIO", () => {
    expect(salarioSortRank(CATEGORY_CODE_SALARIO)).toBe(0);
    expect(salarioSortRank("ALIMENTACAO")).toBe(1);
    expect(salarioSortRank(null)).toBe(1);
  });
});

describe("compareTransactionsByDateThenSalario", () => {
  it("na mesma data coloca SALARIO antes", () => {
    const a = { data: "2026-07-10", categoryCode: "ALIMENTACAO" };
    const b = { data: "2026-07-10", categoryCode: CATEGORY_CODE_SALARIO };
    expect(compareTransactionsByDateThenSalario(a, b, 1)).toBeGreaterThan(0);
    expect(compareTransactionsByDateThenSalario(b, a, 1)).toBeLessThan(0);
  });

  it("mantém SALARIO primeiro também com data desc", () => {
    const a = { data: "2026-07-10", categoryCode: "OUTROS" };
    const b = { data: "2026-07-10", categoryCode: CATEGORY_CODE_SALARIO };
    expect(compareTransactionsByDateThenSalario(a, b, -1)).toBeGreaterThan(0);
  });

  it("ordena por data quando as datas diferem", () => {
    const earlier = { data: "2026-07-09", categoryCode: "OUTROS" };
    const later = { data: "2026-07-10", categoryCode: CATEGORY_CODE_SALARIO };
    expect(compareTransactionsByDateThenSalario(earlier, later, 1)).toBeLessThan(0);
    expect(compareTransactionsByDateThenSalario(earlier, later, -1)).toBeGreaterThan(0);
  });

  it("na mesma data desempata por detalhe após salário", () => {
    const a = { data: "2026-07-10", categoryCode: "OUTROS", detalhe: "Mercado" };
    const b = { data: "2026-07-10", categoryCode: "OUTROS", detalhe: "Padaria" };
    expect(compareTransactionsByDateThenSalario(a, b, 1)).toBeLessThan(0);
    expect(compareTransactionsByDateThenSalario(b, a, 1)).toBeGreaterThan(0);
  });

  it("salário fica antes mesmo com detalhe depois no alfabeto", () => {
    const food = {
      data: "2026-07-10",
      categoryCode: "ALIMENTACAO",
      detalhe: "AAA Mercado",
    };
    const salary = {
      data: "2026-07-10",
      categoryCode: CATEGORY_CODE_SALARIO,
      detalhe: "Salário Faruk",
    };
    expect(compareTransactionsByDateThenSalario(food, salary, 1)).toBeGreaterThan(0);
    expect(compareTransactionsByDateThenSalario(salary, food, 1)).toBeLessThan(0);
  });
});
