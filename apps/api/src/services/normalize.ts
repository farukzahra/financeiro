// Portado de bootstrap_merchants.py / autofill_categorias.py

const SUFIXO_NUMERICO = /[\s-]*\d+\s*$/;
const ESPACOS = /\s+/g;

export function removerAcentos(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizarDetalhe(detalhe: string): string {
  if (!detalhe) return "";
  let s = removerAcentos(detalhe).toUpperCase();
  s = s.replace(ESPACOS, " ").trim();
  s = s.replace(SUFIXO_NUMERICO, "").trim();
  return s;
}

export function splitDescricao(desc: string): { tipo: string; detalhe: string } {
  const d = desc.trim();
  const sep = " - ";
  const idx = d.indexOf(sep);
  if (idx === -1) return { tipo: d, detalhe: "" };
  return { tipo: d.slice(0, idx).trim(), detalhe: d.slice(idx + sep.length).trim() };
}

function extrairNomePix(detalhe: string): string {
  if (!detalhe) return "";
  let nome = detalhe.split(" - ", 1)[0];
  nome = nome.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return nome;
}

export const TIPOS_AUTOMATICOS: Record<string, string> = {
  "Transferência enviada pelo Pix": "PIX",
  "Transferência recebida pelo Pix": "PIX",
  "Transferência Recebida": "PIX",
  "Transferência enviada": "PIX",
};

export function chaveAgrupamento(tipo: string, detalhe: string): string {
  if (!detalhe) {
    return normalizarDetalhe(tipo) || "(SEM DETALHE)";
  }
  if (tipo.includes("Pix") || tipo.startsWith("Transferência")) {
    const nome = extrairNomePix(detalhe);
    return normalizarDetalhe(nome) || normalizarDetalhe(detalhe);
  }
  return normalizarDetalhe(detalhe);
}
