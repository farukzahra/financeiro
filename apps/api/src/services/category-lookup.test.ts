import { describe, expect, it } from "vitest";
import { indexCategories, resolveCategoryCodeAlias } from "./category-lookup.js";

const categories = [
  { id: "00000000-0000-4000-8000-000000000001", code: "OUTROS" },
  { id: "00000000-0000-4000-8000-000000000002", code: "ALIMENTAÇÃO" },
  { id: "00000000-0000-4000-8000-000000000003", code: "PIX" },
];

describe("indexCategories", () => {
  const index = indexCategories(categories);

  it("resolveId aceita uuid da categoria", () => {
    expect(index.resolveId("00000000-0000-4000-8000-000000000002")).toBe(
      "00000000-0000-4000-8000-000000000002",
    );
  });

  it("resolveId aceita code canonico (fluxo import preview → confirm)", () => {
    // Preview/categorizer devolvem categoriaSugerida como code, nao uuid.
    expect(index.resolveId("ALIMENTAÇÃO")).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("resolveId aceita alias legado ALIMENTACAO", () => {
    expect(index.resolveId("ALIMENTACAO")).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("resolveCategoryCodeAlias mapeia legado para code atual no conjunto", () => {
    expect(resolveCategoryCodeAlias("ALIMENTACAO", new Set(["ALIMENTAÇÃO"]))).toBe("ALIMENTAÇÃO");
    expect(resolveCategoryCodeAlias("ALIMENTAÇÃO", new Set(["ALIMENTAÇÃO"]))).toBe("ALIMENTAÇÃO");
  });

  it("resolveId retorna null para code inexistente", () => {
    expect(index.resolveId("INEXISTENTE")).toBeNull();
  });

  it("codeOf traduz uuid de regra do banco para code do categorizer", () => {
    expect(index.codeOf("00000000-0000-4000-8000-000000000003")).toBe("PIX");
  });

  it("codes expoe conjunto de codes para heuristica", () => {
    expect(index.codes()).toEqual(new Set(["OUTROS", "ALIMENTAÇÃO", "PIX"]));
  });
});

describe("regressao import uuid (2026-07-07)", () => {
  it("backend aceita code no confirm quando frontend envia uuid ou code", () => {
    const index = indexCategories(categories);
    const previewCode = "ALIMENTAÇÃO";
    const resolved = index.resolveId(previewCode);
    expect(resolved).not.toBeNull();
    expect(resolved).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
