import { describe, expect, it } from "vitest";
import { extractFileMetadata, parseCsv } from "./parser.js";

describe("extractFileMetadata", () => {
  it("extrai conta e periodo do nome NU_*.csv", () => {
    const buffer = Buffer.from("Data,Valor,Identificador,Descrição\n");
    const meta = extractFileMetadata("NU_941505780_01JUN2026_07JUN2026.csv", buffer);
    expect(meta.conta).toBe("941505780");
    expect(meta.periodoInicio).toBe("2026-06-01");
    expect(meta.periodoFim).toBe("2026-06-07");
    expect(meta.hashSha256).toHaveLength(64);
  });

  it("rejeita nome de arquivo fora do padrao", () => {
    expect(() => extractFileMetadata("extrato.csv", Buffer.from(""))).toThrow(
      /padrao NU_/,
    );
  });
});

describe("parseCsv", () => {
  it("parseia linhas do extrato Nubank", () => {
    const csv = `Data,Valor,Identificador,Descrição
01/06/2026,-50.00,abc-123,Compra no débito - PADARIA TESTE
`;
    const rows = parseCsv(Buffer.from(csv, "utf8"));
    expect(rows).toHaveLength(1);
    expect(rows[0].identificador).toBe("abc-123");
    expect(rows[0].data).toBe("2026-06-01");
    expect(rows[0].valor).toBe("-50.00");
    expect(rows[0].tipo).toBe("Compra no débito");
    expect(rows[0].detalhe).toBe("PADARIA TESTE");
    expect(rows[0].chaveNormalizada).toBe("PADARIA TESTE");
  });
});
