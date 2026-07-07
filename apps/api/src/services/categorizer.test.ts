import { describe, expect, it } from "vitest";
import { categorizeOne, categorizeAll } from "./categorizer.js";
import type { ParsedRow } from "./parser.js";

const baseRow: ParsedRow = {
  identificador: "id-1",
  data: "2026-06-01",
  valor: "-10.00",
  descricaoRaw: "Compra - PADARIA TESTE",
  tipo: "Compra no débito",
  detalhe: "PADARIA TESTE",
  chaveNormalizada: "PADARIA TESTE",
};

const categoryCodes = new Set(["OUTROS", "ALIMENTACAO", "PIX"]);

describe("categorizeOne", () => {
  it("aplica regra de substring com maior prioridade (menor numero)", () => {
    const rules = [
      {
        id: "rule-2",
        categoriaId: "OUTROS",
        tipoPadrao: "substring" as const,
        padrao: "PADARIA",
        prioridade: 200,
      },
      {
        id: "rule-1",
        categoriaId: "ALIMENTACAO",
        tipoPadrao: "substring" as const,
        padrao: "PADARIA",
        prioridade: 10,
      },
    ].sort((a, b) => a.prioridade - b.prioridade);
    const result = categorizeOne(baseRow, rules, categoryCodes);
    expect(result).toEqual({
      categoria: "ALIMENTACAO",
      ruleId: "rule-1",
      regra: "dicionario",
    });
  });

  it("usa heuristica quando nao ha regra e code existe no banco", () => {
    const result = categorizeOne(baseRow, [], categoryCodes);
    expect(result.categoria).toBe("ALIMENTACAO");
    expect(result.regra).toBe("heuristica");
  });

  it("cai em OUTROS quando heuristica nao encontra match", () => {
    const row = { ...baseRow, chaveNormalizada: "SERVICO DESCONHECIDO XYZ" };
    const result = categorizeOne(row, [], categoryCodes);
    expect(result).toEqual({
      categoria: "OUTROS",
      ruleId: null,
      regra: "fallback",
    });
  });

  it("mapeia tipo Pix automatico para code PIX", () => {
    const row: ParsedRow = {
      ...baseRow,
      tipo: "Transferência enviada pelo Pix",
      detalhe: "João Silva",
      chaveNormalizada: "JOAO SILVA",
    };
    const result = categorizeOne(row, [], categoryCodes);
    expect(result.categoria).toBe("PIX");
    expect(result.regra).toBe("tipo_automatico");
  });
});

describe("categorizeAll", () => {
  it("retorna categoriaSugerida como code para cada linha", () => {
    const items = categorizeAll([baseRow], [], categoryCodes);
    expect(items).toHaveLength(1);
    expect(items[0].categoriaSugerida).toBe("ALIMENTACAO");
    expect(items[0].regraAplicada).toBe("heuristica");
  });
});
