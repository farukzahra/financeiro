import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  CAT_ALIMENTACAO,
  createMockApiState,
  mockAuthenticatedApp,
  mockPreviewItem,
  mockPreviewMetadata,
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

  test("aceita múltiplos CSVs e exibe registros na lista", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);

    const secondItem = {
      ...structuredClone(mockPreviewItem),
      identificador: "preview-tx-002",
      detalhe: "SUPERMERCADO E2E",
      descricaoRaw: "Compra no débito - SUPERMERCADO E2E",
    };
    const secondMeta = {
      ...mockPreviewMetadata,
      nomeArquivo: "NU_941505780_08JUN2026_14JUN2026.csv",
      hashSha256: "mock-hash-2",
      periodoInicio: "2026-06-08",
      periodoFim: "2026-06-14",
    };
    secondItem.sourceHashSha256 = secondMeta.hashSha256;

    await page.route("**/api/imports/preview", async (route) => {
      await route.fulfill({
        json: {
          sources: [mockPreviewMetadata, secondMeta],
          itens: [structuredClone(mockPreviewItem), secondItem],
        },
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Importar CSV" }).click();

    const csvPath = path.resolve(
      process.cwd(),
      "../../exemplo_input/NU_941505780_01JUN2026_07JUN2026.csv",
    );
    await page.locator('input[type="file"]').setInputFiles([csvPath, csvPath]);

    await expect(page.getByText("Arquivos:")).toBeVisible();
    await expect(page.getByText("PADARIA TESTE")).toBeVisible();
    await expect(page.getByText("SUPERMERCADO E2E")).toBeVisible();
    await expect(page.getByText("Novas: 2")).toBeVisible();
  });

  test("ícone de duplicata alinha com checkbox na coluna de seleção", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);

    const dupItem = {
      ...structuredClone(mockPreviewItem),
      identificador: "preview-dup",
      detalhe: "LINHA DUPLICADA",
      jaExistente: true,
    };

    await page.route("**/api/imports/preview", async (route) => {
      await route.fulfill({
        json: {
          sources: [mockPreviewMetadata],
          itens: [structuredClone(mockPreviewItem), dupItem],
        },
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Importar CSV" }).click();
    const csvPath = path.resolve(
      process.cwd(),
      "../../exemplo_input/NU_941505780_01JUN2026_07JUN2026.csv",
    );
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await expect(page.getByText("Duplicadas: 1")).toBeVisible();

    const checkboxBox = await page.locator(".preview-table tbody tr").first().locator(".select-cell").boundingBox();
    const iconBox = await page.locator(".preview-table tbody tr").nth(1).locator(".select-cell").boundingBox();
    expect(checkboxBox).toBeTruthy();
    expect(iconBox).toBeTruthy();
    if (checkboxBox && iconBox) {
      const checkboxCenter = checkboxBox.x + checkboxBox.width / 2;
      const iconCenter = iconBox.x + iconBox.width / 2;
      expect(Math.abs(checkboxCenter - iconCenter)).toBeLessThan(3);
    }
  });
});
