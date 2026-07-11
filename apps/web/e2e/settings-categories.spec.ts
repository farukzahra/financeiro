import { test, expect } from "@playwright/test";
import { createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Configurações — categorias", () => {
  test("lista categorias do mock", async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto("/configuracoes");
    await expect(page.getByText("Categorias disponíveis")).toBeVisible();
    await expect(page.locator(".category-code", { hasText: "ALIMENTAÇÃO" })).toBeVisible();
    await expect(page.locator(".category-code", { hasText: "OUTROS" })).toBeVisible();
  });

  test("edita código da categoria", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");

    await page.locator("tbody tr").filter({ hasText: "ALIMENTAÇÃO" }).getByRole("button").click();
    await page.getByPlaceholder("ex: CASA DE PAO").fill("MERCADO");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.locator(".category-code", { hasText: "MERCADO" })).toBeVisible();
    expect(state.categories.find((c) => c.id === "00000000-0000-4000-8000-000000000002")?.code).toBe(
      "MERCADO",
    );
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
