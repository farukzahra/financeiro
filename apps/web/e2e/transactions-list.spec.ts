import { test, expect } from "@playwright/test";
import {
  CAT_OUTROS,
  createMockApiState,
  mockAuthenticatedApp,
  mockTransaction,
} from "./fixtures/mock-api";

test.describe("Transações — listagem", () => {
  test("carrega a lista e o resumo do período", async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto("/");

    await expect(page.getByText("Mercado Central")).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar CSV" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova transação" })).toBeVisible();
    await expect(page.getByText("1 transação")).toBeVisible();
  });

  test("saldo atual ignora filtros e soma todas as transações", async ({ page }) => {
    const state = createMockApiState();
    state.transactions = [
      {
        ...structuredClone(mockTransaction),
        identificador: "tx-salary",
        data: "2026-05-01",
        valor: "1000.00",
        descricaoRaw: "Transferência Recebida - Salário",
        tipo: "Transferência Recebida",
        detalhe: "Salário",
        chaveNormalizada: "salario",
        categoriaId: CAT_OUTROS,
      },
      {
        ...structuredClone(mockTransaction),
        identificador: "tx-market",
        data: "2026-06-01",
        valor: "-50.00",
        descricaoRaw: "Compra - Mercado Central",
        tipo: "Compra",
        detalhe: "Mercado Central",
        chaveNormalizada: "mercado central",
        categoriaId: CAT_OUTROS,
      },
    ];
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    await expect(page.getByText("Salário")).toBeVisible();
    await expect(page.getByText("Mercado Central")).toBeVisible();

    const saldoValue = page.locator(".summary-card").filter({ has: page.locator(".label", { hasText: /^Saldo atual$/ }) }).locator(".value");
    const entradasValue = page.locator(".summary-card").filter({ has: page.locator(".label", { hasText: /^Entradas$/ }) }).locator(".value");
    const saidasValue = page.locator(".summary-card").filter({ has: page.locator(".label", { hasText: /^Saídas$/ }) }).locator(".value");

    await expect(saldoValue).toHaveText(/R\$\s*950,00/);
    await expect(entradasValue).toHaveText(/R\$\s*1\.000,00/);
    await expect(saidasValue).toHaveText(/R\$\s*50,00/);

    await page.getByPlaceholder("descrição ou detalhe").fill("Mercado");
    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(page.getByText("Salário")).toHaveCount(0);
    await expect(page.getByText("Mercado Central")).toBeVisible();
    await expect(page.getByText("1 transação")).toBeVisible();

    // Bug: saldo atual não pode virar só o recorte filtrado (-50).
    await expect(saldoValue).toHaveText(/R\$\s*950,00/);
    await expect(entradasValue).toHaveText(/R\$\s*0,00/);
    await expect(saidasValue).toHaveText(/R\$\s*50,00/);
  });
});
