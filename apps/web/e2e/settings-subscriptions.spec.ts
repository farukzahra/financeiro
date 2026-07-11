import { test, expect } from "@playwright/test";
import { createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Configurações — assinaturas", () => {
  test("cria assinatura e atualiza total", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Assinaturas" }).click();

    await page.getByRole("button", { name: "Nova assinatura" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator(".v-text-field input").first().fill("Cursor E2E");
    await dialog.locator(".v-number-input input").fill("110,53");
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Cursor E2E")).toBeVisible();
    await expect(page.getByText("Total assinaturas:")).toContainText("110,53");
    expect(state.subscriptions.some((s) => s.nome === "Cursor E2E" && s.valorMensal === "110.53")).toBe(
      true,
    );
    expect(state.budget.some((b) => b.origem === "assinaturas" && b.valorMensal === "110.53")).toBe(
      true,
    );
  });

  test("edita e exclui assinatura", async ({ page }) => {
    const state = createMockApiState();
    state.subscriptions.push({
      id: "sub-1",
      nome: "VPS",
      valorMensal: "31.72",
      criadoEm: new Date().toISOString(),
    });
    state.budget.push({
      id: "bud-cc",
      descricao: "Cartão de Crédito",
      categoriaId: null,
      diaVencimento: null,
      valorMensal: "31.72",
      ativo: true,
      origem: "assinaturas",
      criadoEm: new Date().toISOString(),
    });
    await mockAuthenticatedApp(page, state);
    await page.goto("/configuracoes");
    await page.getByRole("tab", { name: "Assinaturas" }).click();

    const row = page.getByRole("row", { name: /VPS/ });
    await row.getByRole("button").first().click();
    const dialog = page.getByRole("dialog");
    await dialog.locator(".v-number-input input").fill("40");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Total assinaturas:")).toContainText("40,00");

    await page.getByRole("row", { name: /VPS/ }).getByRole("button").nth(1).click();
    await page.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByRole("row", { name: /VPS/ })).toHaveCount(0);
    expect(state.subscriptions).toHaveLength(0);
    expect(state.budget.some((b) => b.origem === "assinaturas")).toBe(false);
  });
});
