import { test, expect, type Page } from "@playwright/test";
import {
  CAT_OUTROS,
  createMockApiState,
  mockAuthenticatedApp,
  mockTransaction,
} from "./fixtures/mock-api";

function virtualValue(page: Page) {
  return page.locator(".summary-balance-meta--virtual strong");
}

function systemValue(page: Page) {
  return page.locator(".summary-value--system");
}

function diffValue(page: Page) {
  return page.locator(".summary-balance-meta--diff strong");
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

test.describe("Transações — saldo no banco virtual", () => {
  test("carrega com o total do sistema e fica editável com um clique", async ({
    page,
  }) => {
    await mockAuthenticatedApp(page, setupTwoTransactions());
    await page.goto("/");

    const virtual = virtualValue(page);
    const app = systemValue(page);
    const diff = diffValue(page);

    await expect(virtual).toHaveText(/R\$\s*950,00/);
    await expect(app).toHaveText(/R\$\s*950,00/);
    await expect(diff).toHaveText(/R\$\s*0,00/);

    await virtual.click();
    const input = page.locator(".summary-inline-input input");
    await expect(input).toBeVisible();
    await input.fill("1000");
    await input.press("Enter");

    await expect(page.getByText("Saldo atualizado")).toBeVisible();
    await expect(virtual).toHaveText(/R\$\s*1\.000,00/);
    await expect(app).toHaveText(/R\$\s*950,00/);
    await expect(diff).toHaveText(/R\$\s*50,00/);
  });

  test("novo lançamento reancora o saldo virtual no total do sistema", async ({
    page,
  }) => {
    await mockAuthenticatedApp(page, setupTwoTransactions());
    await page.goto("/");

    const virtual = virtualValue(page);
    const app = systemValue(page);
    const diff = diffValue(page);

    await virtual.click();
    const input = page.locator(".summary-inline-input input");
    await input.fill("1000");
    await input.press("Enter");
    await expect(diff).toHaveText(/R\$\s*50,00/);

    // Entra uma linha nova pelo mesmo caminho da API usada pelo formulário.
    await page.evaluate(async (categoriaId) => {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: "2026-06-10",
          valor: "-10.00",
          tipo: "Compra",
          detalhe: "Nova linha",
          categoriaId,
          observacao: null,
        }),
      });
    }, CAT_OUTROS);

    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(app).toHaveText(/R\$\s*940,00/);
    await expect(virtual).toHaveText(/R\$\s*940,00/);
    await expect(diff).toHaveText(/R\$\s*0,00/);
  });
});
