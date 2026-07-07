export type CategoryRow = {
  id: string;
  code: string;
};

export function indexCategories(rows: CategoryRow[]) {
  const byId = new Map(rows.map((c) => [c.id, c]));
  const byCode = new Map(rows.map((c) => [c.code, c]));

  return {
    resolveId(idOrCode: string): string | null {
      if (byId.has(idOrCode)) return idOrCode;
      return byCode.get(idOrCode)?.id ?? null;
    },
    codeOf(id: string): string {
      return byId.get(id)?.code ?? id;
    },
    codes(): Set<string> {
      return new Set(rows.map((c) => c.code));
    },
  };
}
