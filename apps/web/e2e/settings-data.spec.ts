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
    await expect(panel.getByText("Registros")).toBeVisible();
    await expect(panel.getByText("Saldo total")).toBeVisible();
    await expect(panel.locator(".data-stat__value").first()).toHaveText("1");
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
