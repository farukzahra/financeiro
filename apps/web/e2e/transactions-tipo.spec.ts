import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp, mockTransaction } from "./fixtures/mock-api";

test.describe("Transações — edição inline de tipo", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto("/");
    await expect(page.getByText("Mercado Central")).toBeVisible();
  });

  test("clicar no tipo abre o combobox e mantém o menu aberto", async ({ page }) => {
    await page.getByText("Compra", { exact: true }).click();

    const combobox = page.locator(".v-data-table .v-combobox");
    await expect(combobox).toBeVisible();

    const menu = page.locator(".v-overlay__content .v-list-item").first();
    await expect(menu).toBeVisible();
    await page.waitForTimeout(400);
    await expect(menu).toBeVisible();
    await expect(combobox).toBeVisible();
  });

  test("selecionar outro tipo salva e fecha o editor", async ({ page }) => {
    let patchedBody: { tipo?: string } | null = null;
    await page.route(`**/api/transactions/${mockTransaction.identificador}`, async (route) => {
      if (route.request().method() === "PATCH") {
        patchedBody = route.request().postDataJSON() as { tipo?: string };
        await route.fulfill({
          json: { ...mockTransaction, ...patchedBody },
        });
        return;
      }
      await route.continue();
    });

    await page.getByText("Compra", { exact: true }).click();
    await page.locator(".v-overlay__content .v-list-item").filter({ hasText: "Transferência" }).click();

    await expect.poll(() => patchedBody?.tipo).toBe("Transferência");
    await expect(page.locator(".v-data-table .v-combobox")).toHaveCount(0);
  });
});
