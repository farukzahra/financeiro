import { test, expect } from "@playwright/test";
import {
  CAT_ALIMENTACAO,
  CAT_OUTROS,
  CAT_SALARIO,
  CAT_TRANSPORTE,
  createMockApiState,
  mockAuthenticatedApp,
  mockTransaction,
} from "./fixtures/mock-api";

function withTransaction(
  overrides: Partial<typeof mockTransaction> & { identificador: string },
) {
  return { ...structuredClone(mockTransaction), ...overrides };
}

function dashboardState() {
  const state = createMockApiState();
  state.transactions = [
    withTransaction({
      identificador: "tx-salary-june",
      data: "2026-06-05",
      valor: "5000.00",
      descricaoRaw: "Transferência Recebida - Salário",
      tipo: "Transferência Recebida",
      detalhe: "Salário",
      chaveNormalizada: "salario",
      categoriaId: CAT_SALARIO,
    }),
    withTransaction({
      identificador: "tx-market-june",
      data: "2026-06-06",
      valor: "-200.00",
      descricaoRaw: "Compra - Mercado Central",
      tipo: "Compra",
      detalhe: "Mercado Central",
      chaveNormalizada: "mercado central",
      categoriaId: CAT_ALIMENTACAO,
    }),
    withTransaction({
      identificador: "tx-uber-june",
      data: "2026-06-07",
      valor: "-50.50",
      descricaoRaw: "Compra - Uber",
      tipo: "Compra",
      detalhe: "Uber",
      chaveNormalizada: "uber",
      categoriaId: CAT_TRANSPORTE,
    }),
    withTransaction({
      identificador: "tx-market-may",
      data: "2026-05-20",
      valor: "-100.00",
      descricaoRaw: "Compra - Feira",
      tipo: "Compra",
      detalhe: "Feira",
      chaveNormalizada: "feira",
      categoriaId: CAT_ALIMENTACAO,
    }),
    withTransaction({
      identificador: "tx-older",
      data: "2025-03-10",
      valor: "-80.00",
      descricaoRaw: "Compra - Loja antiga",
      tipo: "Compra",
      detalhe: "Loja antiga",
      chaveNormalizada: "loja antiga",
      categoriaId: CAT_OUTROS,
    }),
  ];
  return state;
}

function summaryValue(page: import("@playwright/test").Page, label: string) {
  return page
    .locator(".sum-card")
    .filter({ has: page.locator(".sum-card__label", { hasText: label }) })
    .locator(".sum-card__value");
}

test.describe("Dashboard — visão anual", () => {
  test("abre no ano atual e soma entradas/saídas por mês", async ({ page }) => {
    await mockAuthenticatedApp(page, dashboardState());
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("button", { name: "2026", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await expect(summaryValue(page, "Entradas no ano")).toHaveText(/R\$\s*5\.000,00/);
    await expect(summaryValue(page, "Saídas no ano")).toHaveText(/R\$\s*350,50/);
    await expect(summaryValue(page, "Saldo do ano")).toHaveText(/R\$\s*4\.649,50/);
    await expect(summaryValue(page, "Mês de maior gasto")).toHaveText(/R\$\s*250,50/);

    await expect(
      page.getByRole("button", {
        name: /Junho de 2026: entradas R\$\s*5\.000,00, saídas R\$\s*250,50/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Dezembro de 2026: sem movimento/ }),
    ).toBeVisible();
  });

  test("clica no mês e mostra as categorias das saídas", async ({ page }) => {
    await mockAuthenticatedApp(page, dashboardState());
    await page.goto("/dashboard");

    await page
      .getByRole("button", { name: /Junho de 2026: entradas/ })
      .click();

    const detail = page.locator("#month-detail");
    await expect(detail.getByRole("heading", { name: "Junho 2026" })).toBeVisible();
    await expect(detail.getByRole("cell", { name: "Alimentação" })).toBeVisible();
    await expect(detail.getByRole("cell", { name: "Transporte" })).toBeVisible();
    await expect(detail.getByRole("cell", { name: "R$ 200,00" })).toBeVisible();
    await expect(detail.getByRole("cell", { name: "R$ 50,50" })).toBeVisible();
    const foodRow = detail.locator("tr").filter({ hasText: "Alimentação" });
    const transportRow = detail.locator("tr").filter({ hasText: "Transporte" });
    await expect(foodRow.getByText("80%")).toBeVisible();
    await expect(transportRow.getByText("20%")).toBeVisible();

    await detail.getByRole("button", { name: "Fechar detalhe do mês" }).click();
    await expect(detail).toHaveCount(0);
  });

  test("troca de ano sem recarregar e atualiza os totais", async ({ page }) => {
    await mockAuthenticatedApp(page, dashboardState());
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "2025", exact: true }).click();

    await expect(page.getByRole("button", { name: "2025", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(summaryValue(page, "Entradas no ano")).toHaveText(/R\$\s*0,00/);
    await expect(summaryValue(page, "Saídas no ano")).toHaveText(/R\$\s*80,00/);

    await page.getByRole("button", { name: /Saídas no ano/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".top-cat")).toContainText("Maior gasto:");
    await expect(dialog.getByText("Outros").first()).toBeVisible();
  });

  test("abre o dialog de categorias do ano pelo card de saídas", async ({ page }) => {
    await mockAuthenticatedApp(page, dashboardState());
    await page.goto("/dashboard");

    await page.getByRole("button", { name: /Saídas no ano/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Acumulado de 2026")).toBeVisible();
    await expect(dialog.locator(".top-cat")).toContainText("Maior gasto:");
    const foodItem = dialog.locator(".cat-item").filter({ hasText: "Alimentação" });
    await expect(foodItem).toContainText("R$ 300,00");
    await expect(foodItem).toContainText("86% das saídas");

    await dialog.getByRole("button", { name: "Fechar saídas por categoria" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
