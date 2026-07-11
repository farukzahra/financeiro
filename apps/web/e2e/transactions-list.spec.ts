import { test, expect } from "@playwright/test";
import {
  CAT_ALIMENTACAO,
  CAT_OUTROS,
  CAT_SALARIO,
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

  test("ordenar por data funciona no segundo clique", async ({ page }) => {
    const state = createMockApiState();
    state.transactions = [
      {
        ...structuredClone(mockTransaction),
        identificador: "tx-old",
        data: "2026-05-01",
        valor: "-10.00",
        detalhe: "Mais antiga",
        descricaoRaw: "Compra - Mais antiga",
        chaveNormalizada: "mais antiga",
      },
      {
        ...structuredClone(mockTransaction),
        identificador: "tx-new",
        data: "2026-06-15",
        valor: "-20.00",
        detalhe: "Mais recente",
        descricaoRaw: "Compra - Mais recente",
        chaveNormalizada: "mais recente",
      },
    ];
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);

    // Default: data asc → mais antiga primeiro
    await expect(rows.nth(0)).toContainText("Mais antiga");
    await expect(rows.nth(1)).toContainText("Mais recente");

    const dataHeader = page.getByRole("columnheader", { name: /Data/i });
    await dataHeader.click();
    await expect(rows.nth(0)).toContainText("Mais recente");
    await expect(rows.nth(1)).toContainText("Mais antiga");

    // Bug: segundo clique não ordenava mais
    await dataHeader.click();
    await expect(rows.nth(0)).toContainText("Mais antiga");
    await expect(rows.nth(1)).toContainText("Mais recente");
  });

  test("na mesma data SALÁRIO aparece antes das outras categorias", async ({ page }) => {
    const state = createMockApiState();
    state.transactions = [
      {
        ...structuredClone(mockTransaction),
        identificador: "tx-food",
        data: "2026-07-10",
        valor: "-40.00",
        detalhe: "Mercado dia 10",
        descricaoRaw: "Compra - Mercado dia 10",
        chaveNormalizada: "mercado dia 10",
        categoriaId: CAT_ALIMENTACAO,
      },
      {
        ...structuredClone(mockTransaction),
        identificador: "tx-salary",
        data: "2026-07-10",
        valor: "5000.00",
        detalhe: "Salário Faruk",
        descricaoRaw: "Transferência Recebida - Salário Faruk",
        tipo: "Transferência Recebida",
        chaveNormalizada: "salario faruk",
        categoriaId: CAT_SALARIO,
      },
    ];
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Salário Faruk");
    await expect(rows.nth(0)).toContainText("SALÁRIO");
    await expect(rows.nth(1)).toContainText("Mercado dia 10");

    await page.getByRole("columnheader", { name: /Data/i }).click();
    await expect(rows.nth(0)).toContainText("Salário Faruk");
    await expect(rows.nth(1)).toContainText("Mercado dia 10");
  });

  test("mostra alerta quando CSV está atrás de D-1", async ({ page }) => {
    const today = new Date();
    const last = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    last.setDate(last.getDate() - 3);
    const y = last.getFullYear();
    const m = String(last.getMonth() + 1).padStart(2, "0");
    const d = String(last.getDate()).padStart(2, "0");
    const ultima = `${y}-${m}-${d}`;

    const state = createMockApiState();
    state.transactions = [
      {
        ...structuredClone(mockTransaction),
        identificador: "tx-stale",
        data: ultima,
        detalhe: "Última importada",
      },
    ];
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    await expect(page.getByText(/Extrato atrasado 2 dias/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar CSV" })).toBeVisible();
  });

  test("painel por categoria exibe code e não descrição", async ({ page }) => {
    const state = createMockApiState();
    state.transactions = [
      {
        ...structuredClone(mockTransaction),
        categoriaId: CAT_ALIMENTACAO,
      },
    ];
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    await page.getByRole("button", { name: "Resumo por categoria" }).click();
    await expect(page.getByText("Por categoria")).toBeVisible();

    const catNome = page.locator(".cat-nome");
    await expect(catNome).toHaveText("ALIMENTAÇÃO");
    await expect(catNome).not.toHaveText("Alimentação");
  });
});
