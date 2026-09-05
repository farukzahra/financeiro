import { test, expect } from "@playwright/test";
import { CAT_ALIMENTACAO, createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Configurações — regras", () => {
  test("cria regra de categorização em memória", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Regras" }).click();

    await page.getByRole("button", { name: "Nova regra" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator(".v-autocomplete").click();
    await page.locator(".v-overlay__content .v-list-item").filter({ hasText: "Alimentação" }).click();
    await dialog.getByPlaceholder("ex: CASA DE PAO BETHELEM L").fill("PADARIA");
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("PADARIA")).toBeVisible();
    expect(state.rules).toHaveLength(1);
    expect(state.rules[0]?.categoriaId).toBe(CAT_ALIMENTACAO);
  });

  test("padrão longo não estoura a coluna nem esconde categoria", async ({ page }) => {
    const longPadrao =
      "CASA DE PAO BETHELEM L COM PADRAO MUITO LONGO PARA NAO ESTOURAR LAYOUT DA TABELA DE REGRAS";
    const state = createMockApiState();
    state.rules.push({
      id: "rule-wide",
      categoriaId: CAT_ALIMENTACAO,
      tipoPadrao: "substring",
      padrao: longPadrao,
      prioridade: 100,
      ativa: true,
    });
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Regras" }).click();

    const row = page.getByRole("row", { name: /CASA DE PAO/ });
    const padraoCell = row.locator("td").nth(2);
    const categoriaCell = row.locator("td").nth(3);

    await expect(categoriaCell).toBeVisible();
    await expect(categoriaCell).toContainText(/Alimentação/i);

    const padraoBox = await padraoCell.boundingBox();
    const categoriaBox = await categoriaCell.boundingBox();
    expect(padraoBox && categoriaBox).toBeTruthy();
    expect((padraoBox?.width ?? 0)).toBeLessThan(520);
    expect(Math.abs((padraoBox?.y ?? 0) - (categoriaBox?.y ?? 0))).toBeLessThan(4);
  });

  test("exclui regra com confirmação", async ({ page }) => {
    const state = createMockApiState();
    state.rules.push({
      id: "rule-del",
      categoriaId: CAT_ALIMENTACAO,
      tipoPadrao: "substring",
      padrao: "PADARIA TESTE",
      prioridade: 100,
      ativa: true,
    });
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Regras" }).click();

    await page.getByRole("row", { name: /PADARIA TESTE/ }).getByRole("button", { name: "Excluir regra" }).click();
    await page.getByRole("button", { name: "Excluir", exact: true }).click();

    await expect(page.getByRole("row", { name: /PADARIA TESTE/ })).toHaveCount(0);
    expect(state.rules).toHaveLength(0);
  });
});
