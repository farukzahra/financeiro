import AdmZip from "adm-zip";
import path from "node:path";

export type CsvUpload = {
  nomeArquivo: string;
  buffer: Buffer;
};

function isCsvName(name: string): boolean {
  return name.toLowerCase().endsWith(".csv");
}

function isZipName(name: string): boolean {
  return name.toLowerCase().endsWith(".zip");
}

function csvFromZip(buffer: Buffer): CsvUpload[] {
  const zip = new AdmZip(buffer);
  const out: CsvUpload[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const nomeArquivo = path.basename(entry.entryName);
    if (!isCsvName(nomeArquivo)) continue;
    out.push({ nomeArquivo, buffer: entry.getData() });
  }
  if (!out.length) {
    throw new Error("ZIP não contém arquivos CSV no padrão NU_<conta>_<periodo>.csv");
  }
  return out;
}

/** Expande uploads (CSV ou ZIP) em buffers CSV individuais. */
export function expandUploadsToCsv(
  uploads: Array<{ filename: string; buffer: Buffer }>,
): CsvUpload[] {
  const csvFiles: CsvUpload[] = [];

  for (const upload of uploads) {
    const name = upload.filename || "arquivo";
    if (isZipName(name)) {
      csvFiles.push(...csvFromZip(upload.buffer));
      continue;
    }
    if (isCsvName(name)) {
      csvFiles.push({ nomeArquivo: path.basename(name), buffer: upload.buffer });
      continue;
    }
    throw new Error(`Formato não suportado: ${name}. Use CSV ou ZIP contendo CSVs.`);
  }

  if (!csvFiles.length) {
    throw new Error("Nenhum arquivo CSV encontrado.");
  }

  return csvFiles;
}
