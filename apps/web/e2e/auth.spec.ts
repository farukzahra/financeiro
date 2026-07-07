import { test, expect } from "@playwright/test";
import { mockLoginScreen } from "./fixtures/mock-api";

test.describe("Login", () => {
  test("exibe formulário quando não autenticado", async ({ page }) => {
    await mockLoginScreen(page);
    await page.goto("/");
    await expect(page.locator("form.login-panel")).toBeVisible();
    await expect(page.locator('form.login-panel button[type="submit"]')).toHaveText("Entrar");
  });

  test("login mockado abre a tela de transações", async ({ page }) => {
    const state = await mockLoginScreen(page);
    await page.goto("/");
    await page.locator('.login-panel input[type="email"]').fill("teste@example.com");
    await page.locator('.login-panel input[type="password"]').fill("senha123");
    await page.locator('form.login-panel button[type="submit"]').click();
    await expect(page.getByText("Mercado Central")).toBeVisible();
    expect(state.authenticated).toBe(true);
  });
});
