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

  test("senha incorreta exibe mensagem amigável", async ({ page }) => {
    await mockLoginScreen(page);
    await page.goto("/");
    await page.locator('.login-panel input[type="email"]').fill("teste@example.com");
    await page.locator('.login-panel input[type="password"]').fill("__wrong__");
    await page.locator('form.login-panel button[type="submit"]').click();
    await expect(page.locator(".login-error")).toHaveText(
      "E-mail ou senha incorretos. Verifique os dados e tente novamente.",
    );
  });

  test("cadastro com e-mail existente exibe mensagem amigável", async ({ page }) => {
    await mockLoginScreen(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.locator('.login-panel input[type="email"]').fill("existente@example.com");
    await page.locator('.login-panel input[type="password"]').fill("senha123");
    await page.locator('form.login-panel button[type="submit"]').click();
    await expect(page.locator(".login-error")).toHaveText(
      "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
    );
  });
});
