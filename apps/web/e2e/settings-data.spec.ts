import { test, expect } from "@playwright/test";
import { createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Configurações — dados", () => {
  test("aba Dados exibe estatísticas em painel", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Dados" }).click();

    const panel = page.locator(".app-panel.data-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".app-panel__title")).toHaveText("Transações no banco");
    await expect(panel.getByText("Registros (total)")).toBeVisible();
    await expect(panel.getByText("Saldo total")).toBeVisible();
    await expect(panel.locator(".data-stat__value").first()).toHaveText("1");
  });

  test("tabela mensal exibe 12 meses do ano atual com zeros", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Dados" }).click();

    const panel = page.locator(".app-panel.data-panel");
    const currentYear = new Date().getFullYear();
    await expect(panel.locator(".data-month-nav__year")).toHaveText(String(currentYear));

    const rows = panel.locator(".month-count-table tbody tr");
    await expect(rows).toHaveCount(12);

    if (currentYear === 2026) {
      await expect(rows.nth(5)).toContainText("junho");
      await expect(rows.nth(5)).toContainText("1");
      await expect(rows.nth(0)).toContainText("0");
    }
  });

  test("navegação por ano mantém tabela visível durante recarga", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state, { statsDelayMs: 500 });
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Dados" }).click();

    const panel = page.locator(".app-panel.data-panel");
    await expect(panel.locator(".month-count-table tbody tr")).toHaveCount(12);

    const refreshVisible = panel.locator(".data-stats-body--refreshing");
    await Promise.all([
      refreshVisible.waitFor({ state: "visible", timeout: 2000 }),
      panel.getByRole("button", { name: "Ano anterior" }).click(),
    ]);
    await expect(panel.locator(".month-count-table tbody tr")).toHaveCount(12);
    await expect(panel.getByRole("button", { name: "Limpar transações" })).toBeVisible();
    await expect(panel.locator(".data-month-nav__year")).toHaveText("2025");
    await expect(refreshVisible).toBeHidden();
  });

  test("navegação por ano altera a tabela mensal", async ({ page }) => {
    const state = createMockApiState();
    state.transactions.push({
      identificador: "tx-2025",
      importId: "imp-1",
      data: "2025-03-15",
      valor: "-10.00",
      descricaoRaw: "Antiga",
      tipo: "Compra",
      detalhe: "Antiga",
      chaveNormalizada: "antiga",
      categoriaId: state.categories[0].id,
      categoryRuleId: null,
      regraAplicada: "manual",
      importadoEm: new Date().toISOString(),
      observacao: null,
    });
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Dados" }).click();

    const panel = page.locator(".app-panel.data-panel");
    await panel.getByRole("button", { name: "Ano anterior" }).click();
    await expect(panel.locator(".data-month-nav__year")).toHaveText("2025");
    await expect(panel.locator(".month-count-table tbody tr").nth(2)).toContainText("1");
    await expect(panel.getByText("Registros em 2025")).toBeVisible();

    await panel.getByRole("button", { name: "Próximo ano" }).click();
    await expect(panel.locator(".data-month-nav__year")).toHaveText(String(new Date().getFullYear()));
  });

  test("limpar transações pede confirmação e zera registros", async ({ page }) => {
    const state = createMockApiState();
    state.transactions.push({
      identificador: "tx-extra",
      importId: "imp-1",
      data: "2026-01-02",
      valor: "-50.00",
      descricaoRaw: "Extra",
      tipo: "Compra",
      detalhe: "Extra",
      chaveNormalizada: "extra",
      categoriaId: state.categories[0].id,
      categoryRuleId: null,
      regraAplicada: "manual",
      importadoEm: new Date().toISOString(),
      observacao: null,
    });
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Dados" }).click();

    await expect(page.locator(".data-stat__value").first()).toHaveText("2");

    await page.getByRole("button", { name: "Limpar transações" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("apaga permanentemente todas as transações");
    await dialog.getByRole("button", { name: "Apagar tudo" }).click();

    await expect(page.getByText("Transações apagadas")).toBeVisible();
    await expect(page.locator(".data-stat__value").first()).toHaveText("0");
    expect(state.transactions).toHaveLength(0);
  });
});
