import { test, expect } from "@playwright/test";
import { createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Transações — orçamento cartão", () => {
  test("mostra Cartão de Crédito sem permitir edição inline", async ({ page }) => {
    const state = createMockApiState();
    state.budget.push({
      id: "bud-cc",
      descricao: "Cartão de Crédito",
      categoriaId: null,
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
    await expect(item.getByText("R$ 606,04")).toBeVisible();

    const locked = item.locator(".budget-edit-val--locked");
    await expect(locked).toBeVisible();
    await locked.click();
    await expect(item.locator(".budget-inline-input")).toHaveCount(0);
  });
});
