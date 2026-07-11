import { test, expect } from "@playwright/test";
import { createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Configurações — preferências", () => {
  test("formulário de preferências usa painel com fundo (app-panel)", async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Preferências" }).click();

    const panel = page.locator(".app-panel.prefs-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".app-panel__title")).toHaveText("Dia de pagamento");
    await expect
      .poll(async () => panel.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(255, 255, 255)");
  });

  test("salva dia de pagamento via PATCH mockado", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Preferências" }).click();

    await page.locator(".salary-cycle-grid .v-select").click();
    await page.getByText("Dia do mês", { exact: true }).click();
    await page.locator(".salary-cycle-grid .v-number-input input").fill("10");
    await page.getByRole("button", { name: "Salvar dia de pagamento" }).click();

    await expect(page.getByText("Dia de pagamento salvo")).toBeVisible();
    const saved = state.user.settings.salaryCycle as {
      paymentDay?: { dayOfMonth?: number };
    };
    expect(saved.paymentDay?.dayOfMonth).toBe(10);
  });
});
