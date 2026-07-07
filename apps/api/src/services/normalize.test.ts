import { describe, expect, it } from "vitest";
import {
  chaveAgrupamento,
  normalizarDetalhe,
  removerAcentos,
  splitDescricao,
} from "./normalize.js";

describe("normalizarDetalhe", () => {
  it("remove acentos, uppercases e sufixo numerico", () => {
    expect(normalizarDetalhe("Padaria São João 123")).toBe("PADARIA SAO JOAO");
  });
});

describe("splitDescricao", () => {
  it("separa tipo e detalhe pelo separador padrao", () => {
    expect(splitDescricao("Compra no débito - MERCADO CRUZ")).toEqual({
      tipo: "Compra no débito",
      detalhe: "MERCADO CRUZ",
    });
  });
});

describe("chaveAgrupamento", () => {
  it("usa detalhe normalizado para compras comuns", () => {
    expect(chaveAgrupamento("Compra no débito", "Mercado Central")).toBe("MERCADO CENTRAL");
  });

  it("extrai nome do Pix para agrupamento", () => {
    expect(
      chaveAgrupamento(
        "Transferência enviada pelo Pix",
        "Maria Souza (12345678900)",
      ),
    ).toBe("MARIA SOUZA");
  });
});

describe("removerAcentos", () => {
  it("normaliza texto para comparacao", () => {
    expect(removerAcentos("Aplicação")).toBe("Aplicacao");
  });
});
