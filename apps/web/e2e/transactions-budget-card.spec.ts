import { test, expect } from "@playwright/test";
import {
  CAT_CARTAO,
  createMockApiState,
  mockAuthenticatedApp,
} from "./fixtures/mock-api";

test.describe("Transações — orçamento cartão", () => {
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
});
