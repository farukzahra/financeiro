/** Códigos antigos ainda resolvíveis após rename no banco */
export const CATEGORY_CODE_ALIASES: Record<string, string> = {
  ALIMENTACAO: "ALIMENTAÇÃO",
};

export type CategoryRow = {
  id: string;
  code: string;
};

export function resolveCategoryCodeAlias(
  code: string,
  existingCodes: Set<string>,
): string | null {
  if (existingCodes.has(code)) return code;
  const aliased = CATEGORY_CODE_ALIASES[code];
  if (aliased && existingCodes.has(aliased)) return aliased;
  for (const [legacy, current] of Object.entries(CATEGORY_CODE_ALIASES)) {
    if (current === code && existingCodes.has(legacy)) return legacy;
  }
  return null;
}

export function indexCategories(rows: CategoryRow[]) {
  const byId = new Map(rows.map((c) => [c.id, c]));
  const byCode = new Map(rows.map((c) => [c.code, c]));

  return {
    resolveId(idOrCode: string): string | null {
      if (byId.has(idOrCode)) return idOrCode;
      const fromCode = byCode.get(idOrCode)?.id;
      if (fromCode) return fromCode;
      const alias = CATEGORY_CODE_ALIASES[idOrCode];
      if (alias) return byCode.get(alias)?.id ?? null;
      return null;
    },
    codeOf(id: string): string {
      return byId.get(id)?.code ?? id;
    },
    codes(): Set<string> {
      return new Set(rows.map((c) => c.code));
    },
  };
}
