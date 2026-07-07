import { test, expect } from "@playwright/test";
import { createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Configurações — categorias", () => {
  test("lista categorias do mock", async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto("/configuracoes");
    await expect(page.getByText("Categorias disponíveis")).toBeVisible();
    await expect(page.locator(".category-code", { hasText: "ALIMENTACAO" })).toBeVisible();
    await expect(page.locator(".category-code", { hasText: "OUTROS" })).toBeVisible();
  });

  test("cria categoria nova só em memória", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");

    await page.getByRole("button", { name: "Nova categoria" }).click();
    await page.getByPlaceholder("ex: CASA DE PAO").fill("UNIMED");
    await page.getByPlaceholder("Nome exibido nas telas").fill("Plano Unimed");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.locator(".category-code", { hasText: "UNIMED" })).toBeVisible();
    expect(state.categories.some((c) => c.code === "UNIMED")).toBe(true);
  });
});
