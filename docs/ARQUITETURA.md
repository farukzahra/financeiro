# Stack JS — Financeiro

Referência do stack JavaScript/TypeScript usado neste projeto, para padronizar
a mesma fullstack JS em outros repositórios.

Versão atual do produto: **0.15.0**

---

## Monorepo

| Item | Escolha |
|------|---------|
| Gerenciador de pacotes | **pnpm** 10 |
| Workspaces | `apps/*` + `packages/*` |
| Linguagem | **TypeScript** 5.6+ |
| Módulos | **ESM** (`"type": "module"`) |
| Runtime | **Node.js** 22 |
| Scripts paralelos | `pnpm -r --parallel run dev` |

---

## FRONTEND

| Camada | Pacote | Versão |
|--------|--------|--------|
| Framework | `vue` | ^3.5 |
| Build / dev server | `vite` | ^5.4 |
| Plugin Vue | `@vitejs/plugin-vue` | ^5.1 |
| Plugin Vuetify | `vite-plugin-vuetify` | ^2.0 |
| Tipagem SFC | `vue-tsc` | ^2.1 |
| Linguagem | `typescript` | ^5.6 |
| Roteamento | `vue-router` | ^4.4 |
| Estado global | `pinia` | ^2.2 |
| UI kit | `vuetify` | ^3.7 |
| Ícones | `@mdi/font` (Material Design Icons) | ^7.4 |
| HTTP client | `axios` | ^1.7 |
| CSS | CSS puro (global + `scoped` por componente) | — |

### Bootstrap (`main.ts`)

```ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import vuetify from "./plugins/vuetify";
import "./styles.css";

app.use(createPinia());
app.use(router);
app.use(vuetify);
```

- Vuetify registrado globalmente via `createVuetify()` em `src/plugins/vuetify.ts`
- Componentes Vuetify disponíveis via **auto-import** do `vite-plugin-vuetify` (não precisa importar `VBtn`, `VDataTable`, etc.)
- Locale: **pt** (`vuetify/locale`)

### Tema Vuetify (`src/plugins/vuetify.ts`)

Tema custom **`financeiro`** — modo claro. Identidade **azul + pêssego/laranja lavado**.

#### Tokens do tema (Vuetify)

| Token | Hex | Uso |
|-------|-----|-----|
| `primary` | `#1E5AA8` | **Ações principais** — `color="primary"` em botões, links, CTAs |
| `secondary` | `#E2C4AD` | Tom lavado (pêssego). Evitar como bloco grande saturado |
| `accent` | `#EDD9C8` | Complementar lavado. Preferir vars CSS `--app-accent-wash*` na UI decorativa |
| `success` | `#16A34A` | Entradas, chips positivos, `color="success"` |
| `warning` | `#CA8A04` | Avisos, duplicatas, `color="warning"` |
| `error` | `#DC2626` | Exclusão, erros, `color="error"` |
| `info` | `#0284C7` | Informações, `color="info"` |
| `background` | `#F8FAFC` | Fundo geral da app |
| `surface` | `#FFFFFF` | Cards, painéis, login |

Defaults globais: `variant="outlined"`, `density="compact"`, `rounded="lg"` nos botões.

Referência Vuetify em runtime: `rgb(var(--v-theme-primary))`, `rgb(var(--v-theme-secondary))`, etc.

---

### Guia de cores para agentes (Vuetify + CSS lavado)

**Regra geral:** a UI deste projeto usa **cores saturadas só em ações** (botões, links, estados).
Elementos decorativos (logo, badges, barras de progresso, destaques de painel) usam **tons lavados**
definidos em `styles.css`. Não use `primary` ou `secondary` saturados como fundo de blocos grandes.

#### Duas camadas de cor

| Camada | Onde definir | Quando usar |
|--------|--------------|-------------|
| **Tema Vuetify** | `plugins/vuetify.ts` | Componentes Vuetify: `v-btn color="primary"`, `v-chip color="success"`, etc. |
| **CSS lavado** | `styles.css` (`--app-*`) | Shell customizado, logo, barras, badges, CSS scoped em views |

#### Variáveis CSS (`styles.css`)

**Espelham o tema Vuetify:**

| Variável | Valor / origem | Uso |
|----------|----------------|-----|
| `--app-primary` | `rgb(var(--v-theme-primary))` | Bordas de foco, ícone ativo na activity bar, hover |
| `--app-secondary` | `rgb(var(--v-theme-secondary))` | Raramente direto — preferir wash |
| `--app-surface` | `rgb(var(--v-theme-surface))` | Header, cards, painéis |
| `--app-background` | `rgb(var(--v-theme-background))` | Fundo body / login |
| `--app-border` | borda Vuetify | Divisórias, bordas de cards |
| `--app-text` | on-surface enfatizado | Texto principal |
| `--app-text-muted` | on-surface médio | Labels, hints, footer |
| `--app-highlight` | primary @ 8% opacidade | Hover em listas, item selecionado |

**Tons lavados (identidade suave — usar em UI decorativa):**

| Variável | Hex | Uso |
|----------|-----|-----|
| `--app-primary-wash` | `#E4EEF8` | Fundo logo **C**, badge admin, aba ativa do login |
| `--app-primary-wash-text` | `#3D6FA3` | Texto/ícone sobre primary-wash |
| `--app-accent-wash` | `#F3E8DE` | Fundos claros com nuance quente (reserva) |
| `--app-accent-wash-deep` | `#E2D0C2` | Barra de progresso do **ciclo salarial** |

Borda suave em elementos primary-wash: `border: 1px solid rgba(30, 90, 168, 0.12)`.

**Valores monetários (fora do tema Vuetify):**

| Classe | Hex | Uso |
|--------|-----|-----|
| `.money-pos` | `#16a34a` | Valores positivos / entradas |
| `.money-neg` | `#dc2626` | Valores negativos / saídas |

#### Onde cada cor já está aplicada (referência)

| Elemento | Cor correta | Arquivo |
|----------|-------------|---------|
| Logo **C** | `--app-primary-wash` + `--app-primary-wash-text` | `styles.css` → `.app-header-logo` |
| Badge **admin** | primary-wash | `App.vue` → `.app-role` |
| Aba login ativa | primary-wash | `App.vue` → `.auth-tabs button.active` |
| Barra ciclo salarial | `--app-accent-wash-deep`, label `#6B5E54` | `TransactionsView.vue` → `.salary-cycle-bar` |
| Botão "Nova transação" | `color="success"` ou `color="primary"` (Vuetify) | views — **ação**, não decoração |
| Activity bar ícone ativo | `--app-primary` | `TransactionsView.vue` → `.activity-item--active` |
| Nav link ativo | `--app-surface` + sombra (não primary sólido) | `styles.css` → `.app-nav-link.router-link-active` |

#### Como agentes devem escolher a cor

```
Nova UI decorativa (fundo, barra, badge, pill)?
  → use --app-primary-wash / --app-accent-wash-deep
  → texto sobre wash: --app-primary-wash-text ou --app-text-muted

Botão ou ação clicável?
  → v-btn color="primary" | "success" | "error" | "warning"
  → outlined/text para ações secundárias

Feedback de estado (sucesso, erro)?
  → useSnackbar + color semântico do Vuetify
  → ou v-chip color="success" | "warning" | "error"

Valor financeiro na tabela?
  → classMoney() + .money-pos / .money-neg (não inventar hex novo)
```

#### O que **não** fazer

- Não usar `#F97316` / laranja saturado em barras ou fundos — ficou forte demais; usar `--app-accent-wash-deep`
- Não colocar logo **C** com `background: var(--app-primary)` + texto branco — usar primary-wash
- Não hardcodar hex solto em views se já existe variável `--app-*` ou token Vuetify
- Não trocar `primary` do tema para tom lavado — primary saturado é intencional nos botões
- Não introduzir Tailwind/theme paralelo; manter Vuetify + `styles.css`

#### Snippets para copiar

Logo / badge lavado (CSS):

```css
background: var(--app-primary-wash);
color: var(--app-primary-wash-text);
border: 1px solid rgba(30, 90, 168, 0.12);
```

Barra de progresso lavada:

```css
background: var(--app-accent-wash-deep);
color: #6B5E54; /* label sobre a barra */
```

Botão de ação principal (Vue):

```vue
<v-btn color="primary">Salvar</v-btn>
<v-btn variant="outlined">Cancelar</v-btn>
```

#### Arquivos fonte da verdade

| Arquivo | Conteúdo |
|---------|----------|
| `apps/web/src/plugins/vuetify.ts` | Tokens Vuetify + defaults de componentes |
| `apps/web/src/styles.css` | Vars `--app-*`, shell, logo, nav, `.money-*` |
| `apps/web/src/App.vue` | Login, header, badge admin |
| `apps/web/src/views/TransactionsView.vue` | Ciclo salarial, activity bar, tabela |

Ao alterar cores, atualizar **este documento** e manter tema + CSS lavado sincronizados.

---

### CSS customizado (`styles.css`)

Variáveis `--app-*` e classes globais do shell. Ver tabela acima em **Guia de cores para agentes**.

Layout shell: header fixo 56px + área scrollável por view. Sem Tailwind/Bootstrap.

### Estrutura de pastas FE

```
apps/web/src/
├── main.ts
├── App.vue                    # login + header + router-outlet
├── router.ts
├── styles.css                 # shell global, header, utilitários monetários
├── plugins/
│   └── vuetify.ts             # tema + defaults
├── composables/
│   ├── useSnackbar.ts         # feedback toast (v-snackbar)
│   └── useConfirm.ts          # confirmação (v-dialog)
├── components/
│   ├── AppSnackbar.vue
│   ├── AppConfirmDialog.vue
│   ├── ImportModal.vue
│   └── ManualTransactionModal.vue
├── views/
│   ├── TransactionsView.vue
│   ├── SettingsView.vue
│   └── AboutView.vue
├── stores/
│   ├── auth.ts
│   └── reference.ts
└── lib/
    ├── api.ts
    ├── categories.ts
    └── format.ts
```

### Componentes Vuetify usados

| Componente | Onde |
|------------|------|
| `v-btn` | Ações, header, formulários |
| `v-text-field` | Texto, email, senha, busca |
| `v-number-input` | Valores monetários, prioridade |
| `v-select` / `v-autocomplete` / `v-combobox` | Categorias, tipos, filtros |
| `v-textarea` | Observações |
| `v-checkbox` / `v-checkbox-btn` | Ativo, seleção em massa |
| `v-data-table` | Transações, categorias, regras, orçamento, preview CSV |
| `v-dialog` | Modais CRUD, importação, confirmação |
| `v-tabs` + `v-window` | Configurações (4 abas) |
| `v-chip` | Tags de status, contadores de import |
| `v-date-picker` + `v-menu` | Período, datas editáveis |
| `v-file-input` | Upload CSV |
| `v-progress-circular` | Loading |
| `v-snackbar` | Notificações globais |
| `v-icon` | Navegação e ações (MDI) |

### Feedback UI (substituto de Toast/ConfirmDialog)

| Antes (PrimeVue) | Agora |
|------------------|-------|
| `useToast()` | `useSnackbar()` → `AppSnackbar.vue` |
| `useConfirm()` | `useConfirm()` → `AppConfirmDialog.vue` |

Montados uma vez em `App.vue`. API compatível:

```ts
snackbar.add({ severity: "success" | "error" | "warn" | "info", summary, detail?, life? });
confirm.require({ message, header?, acceptLabel?, rejectLabel?, accept? });
```

### Convenções FE

- Componentes: `<script setup lang="ts">` (Composition API)
- Ícones: **MDI** via prop `icon="mdi-*"` ou `prepend-icon`
- Alias de path: `@` → `src/`
- Dev server: porta **5173**
- Proxy dev: `/api` → backend local (`http://localhost:3001`)
- Credenciais: `axios` com `withCredentials: true` (cookies de sessão)
- Formulários: defaults globais Vuetify (`outlined`, `compact`)
- Cores: ações → tokens Vuetify (`color="primary"`); decoração → vars lavadas `--app-*-wash` (ver guia acima)
- Valores financeiros: classes `.money-pos`, `.money-neg`, `.money-cell` em `styles.css`

### O que **não** usamos no FE

- Tailwind, Bootstrap, Sass/Less
- CSS Modules
- PrimeVue, PrimeIcons
- Outra lib de componentes além do Vuetify

### Dependências de domínio (específicas deste projeto)

| Pacote | Uso |
|--------|-----|
| `febraban-bank-holidays` | Cálculo de dias úteis / ciclo salarial |

---

## BACKEND

| Camada | Pacote | Versão |
|--------|--------|--------|
| Framework HTTP | `fastify` | ^4.28 |
| CORS | `@fastify/cors` | ^9.0 |
| Upload multipart | `@fastify/multipart` | ^8.3 |
| ORM | `drizzle-orm` | ^0.36 |
| CLI migrations | `drizzle-kit` | ^0.28 |
| Driver PostgreSQL | `postgres` (postgres.js) | ^3.4 |
| Validação / schemas | `zod` | ^3.23 |
| Variáveis de ambiente | `dotenv` | ^16.4 |
| Execução TS (dev) | `tsx` | ^4.19 |
| Tipos Node | `@types/node` | ^22 |
| Linguagem | `typescript` | ^5.6 |
| Build prod | `tsc` → `node dist/index.js` | — |

### Banco de dados

| Item | Escolha |
|------|---------|
| SGBD | **PostgreSQL** 16 |
| ORM | Drizzle (`schema.ts` + migrations SQL) |
| Conexão | `postgres.js` via `DATABASE_URL` |

### Convenções BE

- Entry: `src/index.ts` (Fastify bootstrap + registro de rotas)
- Rotas agrupadas em `src/routes/`
- Lógica de domínio em `src/services/`
- Schema Drizzle em `src/db/schema.ts`
- Migrations em `src/db/migrations/`
- Validação de request/response com **Zod**
- Porta padrão: **3001**
- Auth: cookie HTTP-only assinado (HMAC-SHA256) + hash de senha **scrypt** (Node crypto nativo)

### Dependências de domínio (específicas deste projeto)

| Pacote | Uso |
|--------|-----|
| `papaparse` | Parse de CSV (extratos Nubank) |
| `@types/papaparse` | Tipos (dev) |

---

## SHARED (contratos API ↔ FE)

| Camada | Pacote | Versão |
|--------|--------|--------|
| Schemas / tipos | `zod` | ^3.23 |
| Pacote interno | `@financeiro/shared` (workspace) | — |

### Convenções shared

- Schemas Zod exportam tipo inferido (`z.infer<typeof Schema>`)
- API valida payloads com os mesmos schemas
- FE importa tipos e reutiliza contratos via workspace
- Valores monetários: `string` decimal nos contratos

---

## DESKTOP (opcional)

| Camada | Pacote | Versão |
|--------|--------|--------|
| Shell desktop | `electron` | ^31.7 |
| Entry | `main.cjs` (CommonJS no processo main) | — |

Carrega a mesma SPA do FE (`localhost:5173` em dev ou URL de produção via env).

---

## Resumo copy-paste

### `apps/web/package.json` (dependências base)

```json
{
  "dependencies": {
    "vue": "^3.5.12",
    "vue-router": "^4.4.5",
    "pinia": "^2.2.4",
    "vuetify": "^3.7.4",
    "@mdi/font": "^7.4.47",
    "axios": "^1.7.7"
  },
  "devDependencies": {
    "vite": "^5.4.10",
    "@vitejs/plugin-vue": "^5.1.4",
    "vite-plugin-vuetify": "^2.0.4",
    "typescript": "^5.6.3",
    "vue-tsc": "^2.1.10"
  }
}
```

### `vite.config.ts` (trecho Vuetify)

```ts
import vuetify from "vite-plugin-vuetify";

export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
```

### `apps/api/package.json` (dependências base)

```json
{
  "dependencies": {
    "fastify": "^4.28.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/multipart": "^8.3.0",
    "drizzle-orm": "^0.36.0",
    "postgres": "^3.4.5",
    "zod": "^3.23.8",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "tsx": "^4.19.1",
    "drizzle-kit": "^0.28.0",
    "@types/node": "^22.7.0"
  }
}
```

### `packages/shared/package.json`

```json
{
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

---

## Infra JS adjacente (fora do runtime, mas parte do ecossistema)

| Item | Tecnologia |
|------|------------|
| CI build | GitHub Actions + pnpm + Node 22 |
| Container API | Node 22 Alpine + tsx |
| Container FE (prod) | Build Vite → **Caddy 2** serve SPA + reverse proxy `/api` |
| Scripts utilitários | Node ESM (`scripts/*.mjs`) |

---

## Mapa rápido FE ↔ BE

```
Browser (Vue 3 + Vuetify SPA)
  └── axios (/api, withCredentials)
        └── Vite proxy (dev) ou Caddy (prod)
              └── Fastify API
                    └── Drizzle ORM
                          └── PostgreSQL
```

Contratos compartilhados: `packages/shared` (Zod) consumido por API e Web.

---

## Checklist para replicar em outro projeto

1. Monorepo pnpm com `apps/web`, `apps/api`, `packages/shared`
2. FE: Vue 3 + Vite + Vuetify + `@mdi/font` + `vite-plugin-vuetify`
3. Copiar `plugins/vuetify.ts` + vars lavadas de `styles.css` (ver **Guia de cores para agentes**)
4. Copiar `composables/useSnackbar.ts` + `useConfirm.ts` + componentes globais
5. Copiar `styles.css` (shell, header, `--app-*-wash`, classes monetárias)
6. BE: Fastify + Drizzle + postgres.js + Zod
7. Shared: schemas Zod compartilhados
8. Proxy `/api` no Vite e no Caddy (prod)

Este documento deve ser atualizado quando a stack, tema ou convenções mudarem.
