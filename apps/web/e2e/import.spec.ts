import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  CAT_ALIMENTACAO,
  createMockApiState,
  mockAuthenticatedApp,
  mockPreviewItem,
} from "./fixtures/mock-api";

test.describe("Importar extrato CSV", () => {
  test("preview, seleção e confirmação enviam categoria como uuid", async ({ page }) => {
    const state = createMockApiState();
    let confirmPayload: { itens: { categoriaId: string; identificador: string }[] } | null =
      null;

    await mockAuthenticatedApp(page, state);
    await page.route("**/api/imports/confirm", async (route) => {
      confirmPayload = route.request().postDataJSON() as typeof confirmPayload;
      await route.fallback();
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Importar CSV" }).click();
    await expect(page.getByText("Importar extrato")).toBeVisible();

    const csvPath = path.resolve(
      process.cwd(),
      "../../exemplo_input/NU_941505780_01JUN2026_07JUN2026.csv",
    );
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    await expect(page.getByText("PADARIA TESTE")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Novas: 1")).toBeVisible();

    await page.locator(".v-data-table thead .v-checkbox-btn").click();
    await page.getByRole("button", { name: /Confirmar \(1\)/ }).click();

    await expect.poll(() => confirmPayload?.itens[0]?.categoriaId).toBe(CAT_ALIMENTACAO);
    await expect.poll(() => confirmPayload?.itens[0]?.identificador).toBe(
      mockPreviewItem.identificador,
    );
    await expect.poll(() =>
      state.transactions.some((t) => t.identificador === mockPreviewItem.identificador),
    ).toBe(true);
  });
});
