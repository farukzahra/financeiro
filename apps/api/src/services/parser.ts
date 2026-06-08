import Papa from "papaparse";
import { createHash } from "node:crypto";
import { chaveAgrupamento, splitDescricao } from "./normalize.js";

export type ParsedRow = {
  identificador: string;
  data: string; // yyyy-mm-dd
  valor: string; // decimal como string
  descricaoRaw: string;
  tipo: string;
  detalhe: string;
  chaveNormalizada: string;
};

export type FileMetadata = {
  nomeArquivo: string;
  hashSha256: string;
  conta: string;
  periodoInicio: string; // yyyy-mm-dd
  periodoFim: string;
};

const MESES: Record<string, string> = {
  JAN: "01",
  FEV: "02",
  MAR: "03",
  ABR: "04",
  MAI: "05",
  JUN: "06",
  JUL: "07",
  AGO: "08",
  SET: "09",
  OUT: "10",
  NOV: "11",
  DEZ: "12",
};

// NU_<conta>_<DDMMMYYYY>_<DDMMMYYYY>.csv
const NOME_RE = /^NU_(\d+)_(\d{2})([A-Z]{3})(\d{4})_(\d{2})([A-Z]{3})(\d{4})\.csv$/i;

function parseDataNome(dd: string, mmm: string, yyyy: string): string {
  const mes = MESES[mmm.toUpperCase()];
  if (!mes) throw new Error(`Mes invalido: ${mmm}`);
  return `${yyyy}-${mes}-${dd}`;
}

function parseDataLinha(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split("/");
  if (!d || !m || !y) throw new Error(`Data invalida: ${ddmmyyyy}`);
  return `${y}-${m}-${d}`;
}

export function extractFileMetadata(nomeArquivo: string, buffer: Buffer): FileMetadata {
  const hash = createHash("sha256").update(buffer).digest("hex");
  const match = NOME_RE.exec(nomeArquivo);
  if (!match) {
    throw new Error(
      `Nome de arquivo nao segue padrao NU_<conta>_<DDMMMYYYY>_<DDMMMYYYY>.csv: ${nomeArquivo}`,
    );
  }
  const [, conta, d1, m1, y1, d2, m2, y2] = match;
  return {
    nomeArquivo,
    hashSha256: hash,
    conta,
    periodoInicio: parseDataNome(d1, m1, y1),
    periodoFim: parseDataNome(d2, m2, y2),
  };
}

export function parseCsv(buffer: Buffer): ParsedRow[] {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (result.errors.length) {
    throw new Error(`Erro ao parsear CSV: ${result.errors[0].message}`);
  }

  const rows: ParsedRow[] = [];
  for (const row of result.data) {
    const desc = row["Descrição"] ?? row["Descricao"] ?? "";
    const { tipo, detalhe } = splitDescricao(desc);
    rows.push({
      identificador: row["Identificador"],
      data: parseDataLinha(row["Data"]),
      valor: row["Valor"],
      descricaoRaw: desc,
      tipo,
      detalhe,
      chaveNormalizada: chaveAgrupamento(tipo, detalhe),
    });
  }
  return rows;
}
