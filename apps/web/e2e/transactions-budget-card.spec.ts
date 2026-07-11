import { test, expect } from "@playwright/test";
import {
  CAT_CARTAO,
  createMockApiState,
  mockAuthenticatedApp,
} from "./fixtures/mock-api";

test.describe("Transações — orçamento cartão", () => {
  test("mostra Alimentação com acento no painel de orçamento", async ({ page }) => {
    const state = createMockApiState();
    state.budget.push({
      id: "bud-alim",
      descricao: "Alimentação",
      categoriaId: "00000000-0000-4000-8000-000000000002",
      diaVencimento: null,
      valorMensal: "5000.00",
      ativo: true,
      origem: null,
      criadoEm: new Date().toISOString(),
    });
    await mockAuthenticatedApp(page, state);
    await page.goto("/");
    await page.getByRole("button", { name: "Orçamento previsto" }).click();

    const nome = page.locator(".budget-item-nome").filter({ hasText: "Alimentação" });
    await expect(nome).toBeVisible();
    await expect(nome).toHaveText("Alimentação");
    await expect(page.locator(".budget-item-nome").filter({ hasText: /^Alimentacao$/ })).toHaveCount(0);
  });

  test("mostra Cartão de Crédito na categoria cartão sem edição inline", async ({ page }) => {
    const state = createMockApiState();
    state.budget.push({
      id: "bud-cc",
      descricao: "Cartão de Crédito",
      categoriaId: CAT_CARTAO,
      diaVencimento: null,
      valorMensal: "606.04",
      ativo: true,
      origem: "assinaturas",
      criadoEm: new Date().toISOString(),
    });
    await mockAuthenticatedApp(page, state);
    await page.goto("/");
    await page.getByRole("button", { name: "Orçamento previsto" }).click();

    const item = page.locator(".budget-item").filter({ hasText: "Cartão de Crédito" });
    await expect(item).toBeVisible();
    await expect(item.locator(".budget-edit-val--locked")).toContainText("606,04");
    await expect(item.locator(".budget-progress-wrap")).toBeVisible();

    const locked = item.locator(".budget-edit-val--locked");
    await locked.click();
    await expect(item.locator(".budget-inline-input")).toHaveCount(0);
  });

  test("clique no ciclo salarial aplica período sem sair do orçamento", async ({ page }) => {
    const state = createMockApiState();
    state.user.settings = {
      ...state.user.settings,
      salaryCycle: {
        paymentDay: {
          mode: "dayOfMonth",
          dayOfMonth: 10,
          businessDayOrdinal: null,
        },
      },
      transactionsFilters: {
        activePanel: "budget",
      },
    };
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    const cycle = page.getByRole("button", { name: "Filtrar pelo ciclo salarial" });
    await expect(cycle).toBeVisible();

    const dateSpans = cycle.locator(".salary-cycle-dates span");
    const startLabel = (await dateSpans.nth(0).textContent())?.trim() ?? "";
    const endLabel = (await dateSpans.nth(1).textContent())?.trim() ?? "";
    expect(startLabel.length).toBeGreaterThan(0);
    expect(endLabel.length).toBeGreaterThan(0);

    const txReq = page.waitForRequest(
      (req) =>
        req.method() === "GET" &&
        req.url().includes("/api/transactions") &&
        req.url().includes("from=") &&
        req.url().includes("to="),
    );
    await cycle.click();
    const req = await txReq;
    const url = new URL(req.url());
    expect(url.searchParams.get("from")).toBeTruthy();
    expect(url.searchParams.get("to")).toBeTruthy();

    await expect(page.getByRole("button", { name: "Filtrar pelo ciclo salarial" })).toBeVisible();
    await expect(page.locator(".side-card-title").filter({ hasText: "Orçamento" })).toBeVisible();

    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    await expect(page.getByPlaceholder("Selecione")).toHaveValue(
      new RegExp(`${escapeRegExp(startLabel)}.*${escapeRegExp(endLabel)}`),
    );
  });
});

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
