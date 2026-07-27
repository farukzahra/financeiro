import { test, expect } from "@playwright/test";
import {
  CAT_OUTROS,
  createMockApiState,
  mockAuthenticatedApp,
  mockTransaction,
} from "./fixtures/mock-api";

function saldoCard(page: import("@playwright/test").Page) {
  return page
    .locator(".summary-card")
    .filter({ has: page.locator(".label", { hasText: /^Saldo atual$/ }) })
    .locator(".value");
}

function setupTwoTransactions() {
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
  return state;
}

test.describe("Transações — editar valor inline", () => {
  test("saldo atual recalcula corretamente após alterar valor", async ({ page }) => {
    const state = setupTwoTransactions();
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    const saldoValue = saldoCard(page);
    await expect(saldoValue).toHaveText(/R\$\s*950,00/);

    const row = page.locator("tbody tr").filter({ hasText: "Mercado Central" });
    await row.locator(".money-cell").click();
    const input = row.locator(".value-editor input");
    await input.click({ clickCount: 3 });
    await input.fill("80");
    await input.press("Enter");

    await expect(page.getByText("Atualizado")).toBeVisible();
    // 950 + (-80 - (-50)) = 920
    await expect(saldoValue).toHaveText(/R\$\s*920,00/);
  });

  test("saldo atual recalcula corretamente com filtro ativo (sem recarregar)", async ({ page }) => {
    const state = setupTwoTransactions();
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    const saldoValue = saldoCard(page);
    await expect(saldoValue).toHaveText(/R\$\s*950,00/);

    await page.getByPlaceholder("descrição ou detalhe").fill("Mercado");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByText("Salário")).toHaveCount(0);

    const row = page.locator("tbody tr").filter({ hasText: "Mercado Central" });
    await row.locator(".money-cell").click();
    const input = row.locator(".value-editor input");
    await input.click({ clickCount: 3 });
    await input.fill("80");
    await input.press("Enter");

    await expect(page.getByText("Atualizado")).toBeVisible();
    // Saldo global continua 920, não o recorte filtrado (-80).
    await expect(saldoValue).toHaveText(/R\$\s*920,00/);
  });
});
