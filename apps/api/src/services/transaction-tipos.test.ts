import { describe, expect, it } from "vitest";
import { BASELINE_TRANSACTION_TIPOS, mergeTransactionTipos } from "./transaction-tipos.js";

describe("transaction-tipos", () => {
  it("baseline usa UTF-8 correto (sem mojibake de Latin-1)", () => {
    for (const tipo of BASELINE_TRANSACTION_TIPOS) {
      expect(tipo).not.toMatch(/Ã[§©ª]/);
    }
    expect(BASELINE_TRANSACTION_TIPOS).toContain("Compra no débito");
    expect(BASELINE_TRANSACTION_TIPOS).toContain("Transferência enviada pelo Pix");
  });

  it("mergeTransactionTipos une baseline com tipos do banco sem duplicar", () => {
    const merged = mergeTransactionTipos(BASELINE_TRANSACTION_TIPOS, [
      "Compra no débito",
      "Pix manual",
    ]);
    expect(merged.filter((t) => t === "Compra no débito")).toHaveLength(1);
    expect(merged).toContain("Pix manual");
    expect(merged).toContain("Estorno");
  });
});
