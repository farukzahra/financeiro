import { test, expect } from "@playwright/test";
import { mockAuthenticatedApp } from "./fixtures/mock-api";

test.describe("Sobre", () => {
  test("exibe versão e histórico do build", async ({ page }) => {
    await mockAuthenticatedApp(page);
    await page.goto("/sobre");

    await expect(page.getByRole("heading", { name: "Financeiro" })).toBeVisible();
    await expect(page.getByText("Versão atual do build")).toBeVisible();
    await expect(page.getByText("Histórico curto")).toBeVisible();
    await expect(page.getByText("Combo de categoria inline corrigido")).toBeVisible();
  });
});
