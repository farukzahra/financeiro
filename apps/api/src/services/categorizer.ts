import type { ParsedRow } from "./parser.js";
import { TIPOS_AUTOMATICOS } from "./normalize.js";

export type RegraAplicada =
  | "dicionario"
  | "tipo_automatico"
  | "heuristica"
  | "fallback"
  | "manual";

export type CategoryRuleLite = {
  id: string;
  categoriaId: string;
  tipoPadrao: "substring" | "regex";
  padrao: string;
  prioridade: number;
};

export type CategorizedItem = ParsedRow & {
  categoriaSugerida: string;
  categoryRuleId: string | null;
  regraAplicada: RegraAplicada;
};

// Heuristicas leves (porte do autofill_categorias.REGRAS).
const HEURISTICS: Array<[string, string[]]> = [
  [
    "FARMACIA",
    [
      "FARMA",
      "DROGA",
      "DROGASIL",
      "PANVEL",
      "NISSEI",
      "HIPERFARMA",
      "PRONTOFARMA",
      "CALLFARMA",
      "RAIA",
    ],
  ],
  ["GASOLINA", ["AUTO POSTO", "POSTO ", "POSTO", "MALCA COMERCIO DE COMB"]],
  [
    "ALIMENTACAO",
    [
      "RESTAURANTE",
      "LANCHES",
      "LANCHONETE",
      "PIZZA",
      "BURGER",
      "CHURRAS",
      "CAFETERIA",
      "CAFE ",
      "BAR E GRILL",
      "GRILL",
      "YAKISSOBA",
      "CHINA WOK",
      "POPEYES",
      "EMPORIO",
      "DOCERIA",
      "CONFEITARIA",
      "HORTIFRUTRI",
      "SACOLAO",
      "MERCADO",
      "MERCEARIA",
      "FESTVAL",
      "ATACADAO",
      "SUPERMERCADO",
      "ARMAZEM",
      "PADARIA",
      "BIG REAL",
    ],
  ],
  ["TRANSPORTE", ["ESTACIONAMENTO", "PARK PLATZ", "NIL PARK", "VALET"]],
  ["VIAGEM", ["HOTEL", "AIRBNB"]],
  [
    "COMPRAS",
    [
      "MATERIAIS DE CONST",
      "PAPELARIA",
      "TECIDOS",
      "MODAS",
      "BRINDES",
      "CYBERNET",
      "UNIFORMES",
      "TABACARIA",
      "CENTER PANOS",
      "CASA CHINA",
      "MP *",
      "JIM.COM",
    ],
  ],
  ["AGRO", ["AGRO", "AVIPEC"]],
];

function categorizarHeuristica(chave: string): string | null {
  const alvo = chave.toUpperCase();
  for (const [cat, keywords] of HEURISTICS) {
    for (const kw of keywords) {
      if (alvo.includes(kw)) return cat;
    }
  }
  return null;
}

export function categorizeOne(
  row: ParsedRow,
  rules: CategoryRuleLite[],
  existingCategoryIds: Set<string>,
): { categoria: string; ruleId: string | null; regra: RegraAplicada } {
  for (const r of rules) {
    if (r.tipoPadrao === "regex") {
      try {
        if (new RegExp(r.padrao, "i").test(row.chaveNormalizada)) {
          return { categoria: r.categoriaId, ruleId: r.id, regra: "dicionario" };
        }
      } catch {
        // regex invalido, ignora
      }
    } else if (row.chaveNormalizada.includes(r.padrao)) {
      return { categoria: r.categoriaId, ruleId: r.id, regra: "dicionario" };
    }
  }

  const auto = TIPOS_AUTOMATICOS[row.tipo];
  if (auto && existingCategoryIds.has(auto)) {
    return { categoria: auto, ruleId: null, regra: "tipo_automatico" };
  }

  const heur = categorizarHeuristica(row.chaveNormalizada);
  if (heur && existingCategoryIds.has(heur)) {
    return { categoria: heur, ruleId: null, regra: "heuristica" };
  }

  return { categoria: "OUTROS", ruleId: null, regra: "fallback" };
}

export function categorizeAll(
  rows: ParsedRow[],
  rules: CategoryRuleLite[],
  existingCategoryIds: Set<string>,
): CategorizedItem[] {
  const sorted = [...rules].sort((a, b) => a.prioridade - b.prioridade);
  return rows.map((row) => {
    const { categoria, ruleId, regra } = categorizeOne(row, sorted, existingCategoryIds);
    return {
      ...row,
      categoriaSugerida: categoria,
      categoryRuleId: ruleId,
      regraAplicada: regra,
    };
  });
}
