import type { Page, Route } from "@playwright/test";

export const CAT_OUTROS = "00000000-0000-4000-8000-000000000001";
export const CAT_ALIMENTACAO = "00000000-0000-4000-8000-000000000002";
export const CAT_TRANSPORTE = "00000000-0000-4000-8000-000000000003";

export const mockUser = {
  id: "user-1",
  email: "teste@example.com",
  name: "Teste",
  avatarUrl: null,
  role: "user",
  settings: {} as Record<string, unknown>,
};

export const mockTransaction = {
  identificador: "tx-001",
  importId: "imp-1",
  data: "2026-06-01",
  valor: "-50.00",
  descricaoRaw: "Mercado",
  tipo: "Compra",
  detalhe: "Mercado Central",
  chaveNormalizada: "mercado central",
  categoriaId: CAT_OUTROS,
  categoryRuleId: null,
  regraAplicada: "heuristica",
  importadoEm: "2026-06-01T10:00:00.000Z",
  observacao: null,
};

export const mockPreviewItem = {
  identificador: "preview-tx-001",
  data: "2026-06-02",
  valor: "-25.50",
  descricaoRaw: "Compra no débito - PADARIA TESTE",
  tipo: "Compra no débito",
  detalhe: "PADARIA TESTE",
  chaveNormalizada: "padaria teste",
  categoriaSugerida: "ALIMENTACAO",
  categoryRuleId: null,
  regraAplicada: "heuristica",
  jaExistente: false,
};

export const mockPreviewMetadata = {
  nomeArquivo: "NU_941505780_01JUN2026_07JUN2026.csv",
  hashSha256: "mock-hash",
  conta: "941505780",
  periodoInicio: "2026-06-01",
  periodoFim: "2026-06-07",
  totalLinhas: 1,
  jaImportadoEm: null as string | null,
};

type MockCategory = {
  id: string;
  code: string;
  descricao: string;
  ativa: boolean;
};

type MockRule = {
  id: string;
  categoriaId: string;
  tipoPadrao: "substring" | "regex";
  padrao: string;
  prioridade: number;
  ativa: boolean;
};

type MockBudgetItem = {
  id: string;
  descricao: string;
  categoriaId: string | null;
  diaVencimento: number | null;
  valorMensal: string;
  ativo: boolean;
  criadoEm: string;
};

export type MockApiState = {
  authenticated: boolean;
  user: typeof mockUser;
  categories: MockCategory[];
  rules: MockRule[];
  budget: MockBudgetItem[];
  transactions: (typeof mockTransaction)[];
};

export function createMockApiState(): MockApiState {
  return {
    authenticated: true,
    user: structuredClone(mockUser),
    categories: [
      { id: CAT_OUTROS, code: "OUTROS", descricao: "Outros", ativa: true },
      { id: CAT_ALIMENTACAO, code: "ALIMENTACAO", descricao: "Alimentação", ativa: true },
      { id: CAT_TRANSPORTE, code: "TRANSPORTE", descricao: "Transporte", ativa: true },
    ],
    rules: [],
    budget: [],
    transactions: [structuredClone(mockTransaction)],
  };
}

function summarizePeriod(rows: (typeof mockTransaction)[]) {
  const totalEntradas = rows
    .filter((r) => Number(r.valor) > 0)
    .reduce((acc, r) => acc + Number(r.valor), 0);
  const totalSaidas = rows
    .filter((r) => Number(r.valor) < 0)
    .reduce((acc, r) => acc + Number(r.valor), 0);
  return {
    totalEntradas: totalEntradas.toFixed(2),
    totalSaidas: totalSaidas.toFixed(2),
    qtd: rows.length,
  };
}

function saldoAtual(rows: (typeof mockTransaction)[]) {
  return rows.reduce((acc, r) => acc + Number(r.valor), 0).toFixed(2);
}

function filterTransactions(
  rows: (typeof mockTransaction)[],
  url: URL,
  state: MockApiState,
) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const categories = url.searchParams.getAll("category");

  return rows.filter((row) => {
    if (from && row.data < from) return false;
    if (to && row.data > to) return false;
    if (q) {
      const hay = `${row.descricaoRaw} ${row.detalhe}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (categories.length) {
      const resolved = categories
        .map((c) => resolveCategoryId(state, c))
        .filter((id): id is string => Boolean(id));
      if (resolved.length && !resolved.includes(row.categoriaId)) return false;
    }
    return true;
  });
}

function resolveCategoryId(state: MockApiState, idOrCode: string): string | null {
  const byId = state.categories.find((c) => c.id === idOrCode);
  if (byId) return byId.id;
  const byCode = state.categories.find((c) => c.code === idOrCode);
  return byCode?.id ?? null;
}

function uuid(): string {
  return crypto.randomUUID();
}

export async function installMockApi(page: Page, state: MockApiState) {
  await page.route("**/api/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    const method = route.request().method();

    if (method === "GET" && path === "/auth/me") {
      if (!state.authenticated) {
        return route.fulfill({ status: 401, json: { error: "Nao autenticado" } });
      }
      return route.fulfill({ json: state.user });
    }

    if (method === "POST" && path === "/auth/login") {
      state.authenticated = true;
      return route.fulfill({ json: state.user });
    }

    if (method === "POST" && path === "/auth/register") {
      state.authenticated = true;
      return route.fulfill({ json: state.user });
    }

    if (method === "POST" && path === "/auth/logout") {
      state.authenticated = false;
      return route.fulfill({ json: { ok: true } });
    }

    if (method === "PATCH" && path === "/auth/settings") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.user.settings = { ...state.user.settings, ...body };
      return route.fulfill({ json: state.user });
    }

    if (!state.authenticated) {
      return route.fulfill({ status: 401, json: { error: "Nao autenticado" } });
    }

    if (method === "GET" && path === "/categories") {
      return route.fulfill({ json: state.categories });
    }

    if (method === "POST" && path === "/categories") {
      const body = route.request().postDataJSON() as {
        code: string;
        descricao: string;
        ativa?: boolean;
      };
      const code = body.code.trim().toUpperCase();
      if (state.categories.some((c) => c.code === code)) {
        return route.fulfill({ status: 409, json: { error: "Categoria ja existe" } });
      }
      const row = {
        id: uuid(),
        code,
        descricao: body.descricao,
        ativa: body.ativa ?? true,
      };
      state.categories.push(row);
      return route.fulfill({ json: row });
    }

    const categoryPatch = path.match(/^\/categories\/([^/]+)$/);
    if (method === "PATCH" && categoryPatch) {
      const body = route.request().postDataJSON() as Partial<MockCategory>;
      const row = state.categories.find((c) => c.id === categoryPatch[1]);
      if (!row) return route.fulfill({ status: 404, json: { error: "Nao encontrada" } });
      Object.assign(row, body);
      if (body.code) row.code = body.code.trim().toUpperCase();
      return route.fulfill({ json: row });
    }

    if (method === "GET" && path === "/rules") {
      return route.fulfill({ json: state.rules });
    }

    if (method === "POST" && path === "/rules") {
      const body = route.request().postDataJSON() as {
        categoriaId: string;
        tipoPadrao: "substring" | "regex";
        padrao: string;
        prioridade?: number;
        ativa?: boolean;
      };
      const categoriaId = resolveCategoryId(state, body.categoriaId);
      if (!categoriaId) return route.fulfill({ status: 400, json: { error: "Categoria invalida" } });
      const row: MockRule = {
        id: uuid(),
        categoriaId,
        tipoPadrao: body.tipoPadrao,
        padrao: body.padrao,
        prioridade: body.prioridade ?? 100,
        ativa: body.ativa ?? true,
      };
      state.rules.push(row);
      return route.fulfill({ json: row });
    }

    if (method === "GET" && path === "/transactions/tipos") {
      return route.fulfill({ json: ["Compra", "Transferência"] });
    }

    if (method === "GET" && path === "/transactions") {
      const filtered = filterTransactions(state.transactions, url, state);
      const period = summarizePeriod(filtered);
      return route.fulfill({
        json: {
          itens: filtered,
          resumo: {
            ...period,
            saldo: saldoAtual(state.transactions),
          },
        },
      });
    }

    if (method === "POST" && path === "/transactions") {
      const body = route.request().postDataJSON() as {
        data: string;
        valor: string;
        tipo: string;
        detalhe: string;
        categoriaId: string;
        observacao?: string | null;
      };
      const categoriaId = resolveCategoryId(state, body.categoriaId);
      if (!categoriaId) return route.fulfill({ status: 400, json: { error: "Categoria invalida" } });
      const row = {
        identificador: uuid(),
        importId: "imp-manual",
        data: body.data,
        valor: body.valor,
        descricaoRaw: body.detalhe ? `${body.tipo} - ${body.detalhe}` : body.tipo,
        tipo: body.tipo,
        detalhe: body.detalhe,
        chaveNormalizada: body.detalhe.toLowerCase(),
        categoriaId,
        categoryRuleId: null,
        regraAplicada: "manual",
        importadoEm: new Date().toISOString(),
        observacao: body.observacao ?? null,
      };
      state.transactions.push(row);
      return route.fulfill({ json: row });
    }

    const txPatch = path.match(/^\/transactions\/([^/]+)$/);
    if (method === "PATCH" && txPatch) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const row = state.transactions.find((t) => t.identificador === txPatch[1]);
      if (!row) return route.fulfill({ status: 404, json: { error: "Nao encontrada" } });
      if (typeof body.categoriaId === "string") {
        const categoriaId = resolveCategoryId(state, body.categoriaId);
        if (!categoriaId) return route.fulfill({ status: 400, json: { error: "Categoria invalida" } });
        row.categoriaId = categoriaId;
        row.categoryRuleId = null;
        row.regraAplicada = "manual";
      }
      Object.assign(row, body, { categoriaId: row.categoriaId });
      return route.fulfill({ json: row });
    }

    if (method === "GET" && path === "/budget") {
      return route.fulfill({ json: state.budget });
    }

    if (method === "POST" && path === "/budget") {
      const body = route.request().postDataJSON() as {
        descricao: string;
        categoriaId?: string | null;
        diaVencimento?: number | null;
        valorMensal: string;
        ativo?: boolean;
      };
      const categoriaId = body.categoriaId
        ? resolveCategoryId(state, body.categoriaId)
        : null;
      const row: MockBudgetItem = {
        id: uuid(),
        descricao: body.descricao,
        categoriaId,
        diaVencimento: body.diaVencimento ?? null,
        valorMensal: body.valorMensal,
        ativo: body.ativo ?? true,
        criadoEm: new Date().toISOString(),
      };
      state.budget.push(row);
      return route.fulfill({ json: row });
    }

    const budgetPatch = path.match(/^\/budget\/([^/]+)$/);
    if (method === "PATCH" && budgetPatch) {
      const body = route.request().postDataJSON() as Partial<MockBudgetItem>;
      const row = state.budget.find((b) => b.id === budgetPatch[1]);
      if (!row) return route.fulfill({ status: 404, json: { error: "Nao encontrado" } });
      if (body.categoriaId !== undefined) {
        row.categoriaId = body.categoriaId
          ? resolveCategoryId(state, body.categoriaId)
          : null;
      }
      Object.assign(row, body, { categoriaId: row.categoriaId });
      return route.fulfill({ json: row });
    }

    const budgetDelete = path.match(/^\/budget\/([^/]+)$/);
    if (method === "DELETE" && budgetDelete) {
      const before = state.budget.length;
      state.budget = state.budget.filter((b) => b.id !== budgetDelete[1]);
      if (state.budget.length === before) {
        return route.fulfill({ status: 404, json: { error: "Nao encontrado" } });
      }
      return route.fulfill({ json: { ok: true } });
    }

    if (method === "POST" && path === "/imports/preview") {
      return route.fulfill({
        json: {
          metadata: mockPreviewMetadata,
          itens: [structuredClone(mockPreviewItem)],
        },
      });
    }

    if (method === "POST" && path === "/imports/confirm") {
      const body = route.request().postDataJSON() as {
        metadata: typeof mockPreviewMetadata;
        itens: Array<{
          identificador: string;
          data: string;
          valor: string;
          descricaoRaw: string;
          tipo: string;
          detalhe: string;
          chaveNormalizada: string;
          categoriaId: string;
          categoryRuleId: string | null;
          regraAplicada: string;
        }>;
      };
      let inseridas = 0;
      for (const it of body.itens) {
        const categoriaId = resolveCategoryId(state, it.categoriaId);
        if (!categoriaId) {
          return route.fulfill({ status: 400, json: { error: `Categoria invalida: ${it.categoriaId}` } });
        }
        if (state.transactions.some((t) => t.identificador === it.identificador)) continue;
        state.transactions.push({
          identificador: it.identificador,
          importId: uuid(),
          data: it.data,
          valor: it.valor,
          descricaoRaw: it.descricaoRaw,
          tipo: it.tipo,
          detalhe: it.detalhe,
          chaveNormalizada: it.chaveNormalizada,
          categoriaId,
          categoryRuleId: it.categoryRuleId,
          regraAplicada: it.regraAplicada,
          importadoEm: new Date().toISOString(),
          observacao: null,
        });
        inseridas++;
      }
      return route.fulfill({
        json: {
          importId: uuid(),
          totalLinhas: body.metadata.totalLinhas,
          totalNovas: body.itens.length,
          totalDuplicadas: 0,
          totalImportadas: inseridas,
        },
      });
    }

    return route.fulfill({ status: 404, json: { error: `not mocked: ${method} ${path}` } });
  });
}

export async function mockAuthenticatedApp(page: Page, state = createMockApiState()) {
  await installMockApi(page, state);
  return state;
}

export async function mockLoginScreen(page: Page) {
  const state = createMockApiState();
  state.authenticated = false;
  await installMockApi(page, state);
  return state;
}
