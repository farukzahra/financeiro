import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Transações — listagem", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto("/");
  });

  test("carrega a lista e o resumo do período", async ({ page }) => {
    await expect(page.getByText("Mercado Central")).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar CSV" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova transação" })).toBeVisible();
    await expect(page.getByText("1 transação")).toBeVisible();
  });
});
