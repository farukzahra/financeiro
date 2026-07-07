import { test, expect } from "@playwright/test";
import { CAT_ALIMENTACAO, createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Configurações — regras", () => {
  test("cria regra de categorização em memória", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Regras" }).click();

    await page.getByRole("button", { name: "Nova regra" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator(".v-autocomplete").click();
    await page.locator(".v-overlay__content .v-list-item").filter({ hasText: "Alimentação" }).click();
    await dialog.getByPlaceholder("ex: CASA DE PAO BETHELEM L").fill("PADARIA");
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("PADARIA")).toBeVisible();
    expect(state.rules).toHaveLength(1);
    expect(state.rules[0]?.categoriaId).toBe(CAT_ALIMENTACAO);
  });
});
