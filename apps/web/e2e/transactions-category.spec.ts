import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedApp,
  mockTransaction,
  createMockApiState,
  CAT_ALIMENTACAO,
  CAT_OUTROS,
  CAT_SALARIO,
} from "./fixtures/mock-api";

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

  test("pílulas ALIMENTAÇÃO e SALÁRIO não cortam o texto", async ({ page }) => {
    const state = createMockApiState();
    state.transactions = [
      {
        ...structuredClone(mockTransaction),
        identificador: "tx-alim",
        detalhe: "Mercado com acento",
        categoriaId: CAT_ALIMENTACAO,
      },
      {
        ...structuredClone(mockTransaction),
        identificador: "tx-sal",
        detalhe: "Folha",
        valor: "1000.00",
        categoriaId: CAT_SALARIO,
      },
    ];
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    for (const label of ["ALIMENTAÇÃO", "SALÁRIO"] as const) {
      const nome = page.locator(".cat-pill-nome").filter({ hasText: label });
      await expect(nome).toBeVisible();
      await expect(nome).toHaveText(label);
      const clipped = await nome.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped, `${label} não deve ser cortada na pílula`).toBe(false);
    }
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
