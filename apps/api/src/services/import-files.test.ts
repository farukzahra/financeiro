import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { expandUploadsToCsv } from "./import-files.js";

const CSV_NAME = "NU_941505780_01JUN2026_07JUN2026.csv";
const CSV_BODY = Buffer.from(
  "Data,Valor,Identificador,Descrição\n01/06/2026,-1.00,id-1,Compra - LOJA\n",
  "utf8",
);

describe("expandUploadsToCsv", () => {
  it("aceita CSV direto", () => {
    const files = expandUploadsToCsv([{ filename: CSV_NAME, buffer: CSV_BODY }]);
    expect(files).toHaveLength(1);
    expect(files[0].nomeArquivo).toBe(CSV_NAME);
  });

  it("extrai CSVs de um ZIP", () => {
    const zip = new AdmZip();
    zip.addFile(CSV_NAME, CSV_BODY);
    zip.addFile("pasta/outro.csv", CSV_BODY);
    const files = expandUploadsToCsv([{ filename: "extratos.zip", buffer: zip.toBuffer() }]);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.nomeArquivo)).toEqual([CSV_NAME, "outro.csv"]);
  });

  it("rejeita ZIP sem CSV", () => {
    const zip = new AdmZip();
    zip.addFile("readme.txt", Buffer.from("oi"));
    expect(() =>
      expandUploadsToCsv([{ filename: "vazio.zip", buffer: zip.toBuffer() }]),
    ).toThrow(/ZIP não contém arquivos CSV/);
  });

  it("rejeita extensão desconhecida", () => {
    expect(() =>
      expandUploadsToCsv([{ filename: "extrato.xlsx", buffer: Buffer.from("") }]),
    ).toThrow(/Formato não suportado/);
  });
});
