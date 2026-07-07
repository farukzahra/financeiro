import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp, mockTransaction, CAT_ALIMENTACAO, CAT_OUTROS } from "./fixtures/mock-api";

test.describe("Transações — edição inline de categoria", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto("/");
    await expect(page.getByText("Mercado Central")).toBeVisible();
  });

  test("pill exibe rótulo curto do código", async ({ page }) => {
    const pill = page.getByRole("row", { name: /Mercado Central/ }).locator(".cat-pill-nome");
    await expect(pill).toHaveText("OUTROS");
    await expect(pill).not.toContainText(CAT_OUTROS);
  });

  test("menu de categoria permanece aberto após o clique", async ({ page }) => {
    await page.locator(".cat-pill").first().click();

    const menu = page.locator(".v-overlay__content .v-list-item").first();
    await expect(menu).toBeVisible();
    await page.waitForTimeout(400);
    await expect(menu).toBeVisible();
    await expect(page.locator(".v-data-table .v-autocomplete")).toBeVisible();
  });

  test("selecionar outra categoria salva e fecha o editor", async ({ page }) => {
    let patchedBody: { categoriaId?: string } | null = null;
    await page.route(`**/api/transactions/${mockTransaction.identificador}`, async (route) => {
      if (route.request().method() === "PATCH") {
        patchedBody = route.request().postDataJSON() as { categoriaId?: string };
        await route.fulfill({
          json: {
            ...mockTransaction,
            categoriaId: patchedBody.categoriaId,
            regraAplicada: "manual",
            categoryRuleId: null,
          },
        });
        return;
      }
      await route.continue();
    });

    await page.locator(".cat-pill").first().click();
    await page.locator(".v-overlay__content .v-list-item").filter({ hasText: "ALIMENTAÇÃO" }).click();

    await expect.poll(() => patchedBody?.categoriaId).toBe(CAT_ALIMENTACAO);
    await expect(page.locator(".cat-pill")).toBeVisible();
    await expect(page.getByRole("row", { name: /Mercado Central/ }).locator(".cat-pill-nome")).toHaveText(
      "ALIMENTAÇÃO",
    );
    await expect(page.locator(".v-data-table .v-autocomplete")).toHaveCount(0);
  });
});
