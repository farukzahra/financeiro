import { test, expect } from "@playwright/test";
import { CAT_ALIMENTACAO, createMockApiState, mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Nova transação manual", () => {
  test("cria transação digitando o tipo via POST mockado sem banco real", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    await page.getByRole("button", { name: "Nova transação" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Nova transação manual")).toBeVisible();

    await dialog.locator(".v-number-input input").fill("120");
    await dialog.locator(".v-combobox input").fill("Compra");
    await page.getByPlaceholder("Descrição do destinatário / loja").fill("Farmácia E2E");
    await dialog.locator(".v-autocomplete").click();
    await page.locator(".v-overlay__content .v-list-item").filter({ hasText: "Alimentação" }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect.poll(() => state.transactions.some((t) => t.detalhe === "Farmácia E2E")).toBe(true);
    expect(state.transactions.find((t) => t.detalhe === "Farmácia E2E")?.categoriaId).toBe(
      CAT_ALIMENTACAO,
    );
    await expect(page.getByText("Farmácia E2E")).toBeVisible();
  });

  test("seleciona tipo na lista do combobox e salva sem erro", async ({ page }) => {
    const state = createMockApiState();
    await mockAuthenticatedApp(page, state);
    await page.goto("/");

    await page.getByRole("button", { name: "Nova transação" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Nova transação manual")).toBeVisible();

    await dialog.locator(".v-number-input input").fill("85");
    await dialog.locator(".v-combobox").click();
    await page.locator(".v-overlay__content .v-list-item").filter({ hasText: "Transferência" }).click();
    await page.getByPlaceholder("Descrição do destinatário / loja").fill("Pix E2E combobox");
    await dialog.locator(".v-autocomplete").click();
    await page.locator(".v-overlay__content .v-list-item").filter({ hasText: "Transporte" }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect.poll(() =>
      state.transactions.some((t) => t.detalhe === "Pix E2E combobox" && t.tipo === "Transferência"),
    ).toBe(true);
    await expect(page.getByText("Pix E2E combobox")).toBeVisible();
  });
});
