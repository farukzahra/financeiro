import { describe, expect, it } from "vitest";
import { BUDGET_ORIGEM_ASSINATURAS } from "@financeiro/shared";
import {
  CREDIT_CARD_BUDGET_DESCRICAO,
  creditCardBudgetAction,
  isSystemBudgetOrigem,
  sumMonthlyValues,
} from "./credit-card-budget.js";

describe("sumMonthlyValues", () => {
  it("soma valores decimais das assinaturas seed", () => {
    expect(
      sumMonthlyValues([
        "110.53",
        "195.00",
        "159.90",
        "53.90",
        "9.99",
        "45.00",
        "31.72",
      ]),
    ).toBe("606.04");
  });

  it("retorna 0.00 para lista vazia", () => {
    expect(sumMonthlyValues([])).toBe("0.00");
  });
});

describe("creditCardBudgetAction", () => {
  it("upsert quando soma > 0", () => {
    expect(creditCardBudgetAction("606.04")).toBe("upsert");
  });

  it("delete quando soma é zero", () => {
    expect(creditCardBudgetAction("0.00")).toBe("delete");
  });
});

describe("isSystemBudgetOrigem", () => {
  it("reconhece origem assinaturas", () => {
    expect(isSystemBudgetOrigem(BUDGET_ORIGEM_ASSINATURAS)).toBe(true);
    expect(isSystemBudgetOrigem(null)).toBe(false);
    expect(isSystemBudgetOrigem(undefined)).toBe(false);
  });
});

describe("CREDIT_CARD_BUDGET_DESCRICAO", () => {
  it("usa o rótulo Cartão de Crédito", () => {
    expect(CREDIT_CARD_BUDGET_DESCRICAO).toBe("Cartão de Crédito");
  });
});
