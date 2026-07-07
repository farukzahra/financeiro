import type { Page, Route } from "@playwright/test";

const mockUser = {
  id: "user-1",
  email: "teste@example.com",
  name: "Teste",
  avatarUrl: null,
  role: "user",
  settings: {},
};

const mockCategories = [
  { id: "OUTROS", descricao: "Outros", ativa: true },
  { id: "ALIMENTACAO", descricao: "Alimentação", ativa: true },
  { id: "TRANSPORTE", descricao: "Transporte", ativa: true },
];

export const mockTransaction = {
  identificador: "tx-001",
  importId: "imp-1",
  data: "2026-06-01",
  valor: "-50.00",
  descricaoRaw: "Mercado",
  tipo: "Compra",
  detalhe: "Mercado Central",
  chaveNormalizada: "mercado central",
  categoriaId: "OUTROS",
  categoryRuleId: null,
  regraAplicada: "heuristica",
  importadoEm: "2026-06-01T10:00:00.000Z",
  observacao: null,
};

export async function mockAuthenticatedApp(page: Page) {
  await page.route("**/api/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    const method = route.request().method();

    if (method === "GET" && path === "/auth/me") {
      return route.fulfill({ json: mockUser });
    }
    if (method === "GET" && path === "/categories") {
      return route.fulfill({ json: mockCategories });
    }
    if (method === "GET" && path === "/rules") {
      return route.fulfill({ json: [] });
    }
    if (method === "GET" && path === "/transactions/tipos") {
      return route.fulfill({ json: ["Compra"] });
    }
    if (method === "GET" && path === "/transactions") {
      return route.fulfill({
        json: {
          itens: [mockTransaction],
          resumo: {
            totalEntradas: "0",
            totalSaidas: "-50.00",
            saldo: "-50.00",
            qtd: 1,
          },
        },
      });
    }
    if (method === "GET" && path === "/budget") {
      return route.fulfill({ json: [] });
    }
    if (method === "PATCH" && path === `/transactions/${mockTransaction.identificador}`) {
      const body = route.request().postDataJSON() as { categoriaId?: string };
      return route.fulfill({
        json: { ...mockTransaction, ...body, regraAplicada: "manual", categoryRuleId: null },
      });
    }

    return route.fulfill({ status: 404, json: { error: "not mocked" } });
  });
}
