import { test, expect } from "@playwright/test";
import { CAT_ALIMENTACAO, createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Configurações — orçamento", () => {
  test("cria item de orçamento em memória", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Orçamento" }).click();

    await page.getByRole("button", { name: "Novo item" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator(".v-text-field input").first().fill("Internet E2E");
    await dialog.locator(".v-number-input input").last().fill("150");
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Internet E2E")).toBeVisible();
    expect(state.budget.some((b) => b.descricao === "Internet E2E")).toBe(true);
  });

  test("lista categoria do item em caixa alta com acento (code)", async ({ page }) => {
    const state = createMockApiState();
    state.budget = [
      {
        id: "bud-alim-1",
        descricao: "Mercado mensal",
        categoriaId: CAT_ALIMENTACAO,
        diaVencimento: 5,
        valorMensal: "500.00",
        ativo: true,
        origem: null,
        criadoEm: "2026-06-01T10:00:00.000Z",
      },
    ];
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Orçamento" }).click();

    const row = page.locator("tbody tr").filter({ hasText: "Mercado mensal" });
    await expect(row).toContainText("ALIMENTAÇÃO");
    await expect(row).not.toContainText("ALIMENTACAO");
  });
});
