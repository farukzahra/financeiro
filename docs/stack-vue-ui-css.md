# Stack Vue, CSS e comportamento da UI — Financeiro

Referência para replicar o mesmo template, estilo e padrões de layout em outro projeto.

---

## 1. Stack técnica

| Camada | Tecnologia | Versão (aprox.) |
|--------|------------|-----------------|
| Framework | Vue 3 (`<script setup lang="ts">`) | ^3.5 |
| Build | Vite | ^5.4 |
| Tipagem | TypeScript + `vue-tsc` | ^5.6 |
| Roteamento | Vue Router (`createWebHistory`) | ^4.4 |
| Estado | Pinia | ^2.2 |
| UI kit | PrimeVue 4 + tema **Aura** (`@primevue/themes/aura`) | ^4.1 |
| Ícones | PrimeIcons (`pi pi-*`) | ^7.0 |
| HTTP | Axios | ^1.7 |
| CSS | CSS puro (global + `scoped` por componente) | — |

**O que não usamos:** Tailwind, Bootstrap, Sass/Less, CSS Modules, biblioteca de componentes além do PrimeVue.

---

## 2. Bootstrap da aplicação

### `index.html`

- `lang="pt-BR"`
- Viewport responsivo
- Um único `#app` montado por `main.ts`

### `main.ts`

```ts
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import ToastService from "primevue/toastservice";
import ConfirmationService from "primevue/confirmationservice";
import "primeicons/primeicons.css";
import "./styles.css";

app.use(PrimeVue, {
  theme: { preset: Aura, options: { darkModeSelector: ".dark" } },
});
app.use(ToastService);
app.use(ConfirmationService);
```

- Tema Aura com variáveis CSS `--p-*` (ex.: `--p-primary-color`, `--p-content-background`)
- Dark mode preparado via classe `.dark` no elemento raiz (não ativado por padrão)
- Toast e ConfirmDialog globais (montados em `App.vue`)

### `vite.config.ts`

- Alias `@` → `src/`
- Dev server na porta **5173**
- Proxy `/api` → backend local

### Estrutura de pastas (`apps/web/src/`)

```
src/
├── App.vue              # shell: auth, header, router-outlet
├── main.ts
├── router.ts
├── styles.css           # CSS global (layout shell, header, utilitários)
├── components/          # modais reutilizáveis
├── views/               # páginas de rota
├── stores/              # Pinia (auth, reference)
└── lib/                 # api, format, helpers
```

---

## 3. Padrão de componente Vue

Todo `.vue` segue:

1. `<script setup lang="ts">` — imports explícitos (sem registro global de componentes PrimeVue)
2. `<template>` — HTML semântico + classes utilitárias próprias
3. `<style scoped>` — estilos locais da tela/modal (quando necessário)

**Convenções PrimeVue usadas em quase todos os formulários:**

- Prop `fluid` nos inputs (`InputText`, `Select`, `DatePicker`, `Password`, etc.) para largura 100%
- Ícones via prop `icon="pi pi-*"` nos `Button`
- Feedback: `useToast()` e `useConfirm()` para erros, sucesso e exclusões
- Tabelas: `DataTable` + `Column`, geralmente `size="small"` e `stripedRows`

---

## 4. Estratégia de CSS

### 4.1 CSS global (`styles.css`)

Responsável por:

- Reset mínimo (`box-sizing`, `body`/`#app` com `height: 100vh`, `overflow: hidden`)
- **Shell da app autenticada:** header fixo + área principal scrollável
- Classes compartilhadas entre telas:
  - `.app-header`, `.app-header-brand`, `.app-header-logo`, `.app-header-title`
  - `.app-header-nav`, `.app-nav-link` (navegação central com pill/tabs)
  - `.app-shell` (conteúdo das rotas)
  - `.money-pos`, `.money-neg`, `.money-cell` (valores monetários)
  - `.summary-cards`, `.summary-card` (cards de resumo — versão base)
- Breakpoint mobile em **760px** (esconde textos do header, mantém só ícones)

### 4.2 CSS scoped por view/modal

Cada tela define layout próprio dentro de `<style scoped>`:

- `App.vue` — login, loading, área do usuário no header
- `TransactionsView.vue` — grid lateral + painel + tabela (maior arquivo de estilo)
- `SettingsView.vue` — página scrollável com abas
- `AboutView.vue` — página informativa com gradiente de fundo
- `ManualTransactionModal.vue` — grid de formulário

### 4.3 Integração com PrimeVue

- Cores, bordas e fundos usam variáveis do tema: `var(--p-content-border-color)`, `var(--p-text-muted-color, #6b7280)`, etc.
- Fallbacks hex quando a variável não existe
- Para estilizar filhos do PrimeVue dentro de scoped: `:deep(.p-button)`, `:deep(.p-datepicker)`, etc.
- Classes nativas do PrimeVue (`.p-button`) usadas pontualmente em seletores scoped

### 4.4 Tipografia e números

- Fonte: `system-ui, -apple-system, Segoe UI, sans-serif`
- Valores financeiros: `font-variant-numeric: tabular-nums`
- Positivo: `#16a34a` (`.money-pos`)
- Negativo: `#dc2626` (`.money-neg`)

### 4.5 Layout geral autenticado

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER (56px) — logo | nav central | usuário + logout       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ROUTER VIEW (100% altura restante, overflow controlado)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- `body` e `#app` não rolam; cada view gerencia seu próprio scroll interno

---

## 5. Comportamento da UI — descrição textual

### 5.1 Fluxo de autenticação (`App.vue`)

**Estado de carregamento inicial**

- Enquanto `auth.loading === true`, a tela inteira mostra apenas um spinner centralizado (`pi pi-spin pi-spinner`) em fundo do tema.

**Usuário não logado — tela de login**

- Layout centralizado vertical e horizontalmente (`login-shell`)
- Painel branco/card com borda (`login-panel`, ~380px de largura máxima)
- No topo do painel: **mesmo branding do header** — quadrado colorido com letra **"C"** + título **"Financeiro"**
- Abas internas **Entrar** / **Criar conta** (`auth-tabs`): botões em grid 2 colunas; aba ativa usa cor primária do tema
- Campos: Nome (só no cadastro), Email, Senha (`Password` com toggle de visibilidade)
- Botão submit ocupa largura total (`fluid`)
- Erros aparecem via Toast (não só inline)

**Usuário logado — shell principal**

- Header fixo + `<RouterView />` dentro de `<main class="app-shell">`

---

### 5.2 Menu superior (header global)

Presente em **todas** as rotas autenticadas. Altura fixa **56px**, borda inferior, fundo do tema.

**Esquerda — marca**

- Quadrado **30×30px**, cantos arredondados (8px), fundo na cor primária, letra branca **"C"** (bold)
- Ao lado: texto **"Financeiro"** (fonte ~1rem, peso 600)
- No mobile (<760px): o título some; fica só o ícone "C"

**Centro — navegação principal**

- Barra pill centralizada absolutamente (`left: 50%` + `transform`) — visual de segmented control
- Três links com `RouterLink`:
  1. **Transações** (`/`) — ícone `pi-list`
  2. **Configurações** (`/configuracoes`) — ícone `pi-cog`
  3. **Sobre** (`/sobre`) — ícone `pi-info-circle`
- Link ativo: fundo elevado + sombra leve (`router-link-active`)
- Hover: fundo suave + cor de texto normal
- Mobile: só ícones (texto `<span>` oculto); cada link vira botão quadrado ~36px

**Direita — usuário**

- Alinhado à direita (`margin-left: auto`)
- Se `role === 'admin'`: badge pill **"admin"** (fundo primário, texto branco, fonte pequena)
- Email do usuário logado (truncado com ellipsis, max ~220px, cor muted)
- Botão **logout**: ícone `pi-sign-out`, estilo `text rounded` (sem label visível)
- Mobile: email some; permanecem badge admin (se houver) e botão de sair

**Serviços globais no topo da árvore**

- `<Toast />` — notificações canto da tela
- `<ConfirmDialog />` — confirmação antes de excluir registros

---

### 5.3 Tela principal — Transações (`/`)

Layout em **grid de 3 colunas** quando um painel lateral está aberto:

```
[ barra ícones 48px ] [ painel lateral 280px ] [ conteúdo principal flex ]
```

Quando nenhum painel está aberto (`activePanel === null`):

```
[ barra ícones 48px ] [ conteúdo principal flex ]
```

A altura ocupa **100%** da área abaixo do header; scroll só na coluna central.

#### Barra de atividade lateral esquerda (48px)

Coluna fixa à esquerda com **3 botões ícone empilhados** (não é menu de rotas — são toggles de painéis):

| Ícone | Painel | Função |
|-------|--------|--------|
| `pi-filter` | `filters` | Filtros (período, categorias, busca) |
| `pi-tags` | `cats` | Resumo por categoria |
| `pi-wallet` | `budget` | Orçamento previsto + ciclo salarial |

**Comportamento toggle (importante):**

- Clicar no ícone **abre** aquele painel se estiver fechado ou se outro estiver aberto
- Clicar **de novo no mesmo ícone** **fecha** o painel (`activePanel = null`)
- Só **um painel por vez** — trocar de ícone substitui o conteúdo lateral
- Ícone ativo: cor primária + barra vertical fina à esquerda do botão
- Tooltip dinâmico: "Mostrar X" / "Ocultar X" conforme estado
- Estado do painel aberto é **persistido por usuário** nas preferências

#### Painel lateral (280px) — conteúdo por aba

**Aba Filtros**

- Cabeçalho "Filtros"
- Período: `DatePicker` range, 2 meses, ícone, barra de botões, `appendTo="body"`
- Botão X ao lado limpa o período
- Categorias: `MultiSelect` com chips e filtro
- Busca: texto livre (Enter ou botão Filtrar)
- Botões "Filtrar" (primário) e "Limpar" (outlined, desabilitado se não há filtro)

**Aba Por categoria**

- Lista scrollável de categorias com total e quantidade no período filtrado
- Borda esquerda colorida por categoria
- Clique em item **adiciona/remove** filtro daquela categoria
- Item ativo (categoria no filtro): fundo highlight
- Estado vazio: "Sem transações no filtro atual."

**Aba Orçamento**

- Cabeçalho com totais **Previsto** e **Orçamento restante**
- Bloco **Ciclo salarial**: barra de progresso verde com % e datas início/fim; dias restantes
- Lista de itens de orçamento ativos com:
  - Handle de arrastar (`pi-bars`) para reordenar (drag-and-drop)
  - Barra de progresso colorida por categoria (% gasto)
  - Valor previsto editável inline (clique → `InputNumber`, Enter/blur salva, Esc cancela)
- Itens alternam fundo zebrado; hover e estados de drag têm feedback visual

#### Coluna central (conteúdo principal)

**Barra de ações**

- "Nova transação" (verde/success) → abre modal manual
- "Importar CSV" (outlined) → abre modal de importação

**Cards de resumo (4 colunas em desktop)**

1. Saldo atual
2. Saldo líquido (saldo − orçamento restante)
3. Entradas
4. Saídas

- Cada card: label uppercase pequena + valor grande
- Hover/focus: tooltip escuro acima do card com fórmula explicativa
- Cores: verde entradas, vermelho saídas, `classMoney` nos saldos

**Tabela de transações (`DataTable`)**

- Ordenação por coluna (persistida)
- Edição inline por clique nas células (data, tipo, detalhe, valor)
- Categoria: pill colorido clicável → vira `Select`
- Coluna valor alinhada à direita (`:deep` no header/body)
- Ações por linha: gerar regra (`pi-sitemap`) e excluir (`pi-trash`), botões compactos
- Rodapé: contagem "N transação(ões)" alinhada à direita

**Modais**

- `ImportModal`: upload CSV → preview → confirmação
- `ManualTransactionModal`: formulário em grid 2 colunas

---

### 5.4 Tela Configurações (`/configuracoes`)

- Página com scroll vertical (`settings-page`, padding lateral)
- **PrimeVue TabView** com 4 abas horizontais no topo da página (não confundir com a barra lateral de Transações):

| Aba | Conteúdo |
|-----|----------|
| Categorias | DataTable + botão "Nova categoria" + editar |
| Regras | DataTable de regras de categorização + criar |
| Orçamento | CRUD completo de itens (tabela + dialog) |
| Preferências | Dia de pagamento / ciclo salarial |

- Padrão de cada aba: cabeçalho com título + botão de ação à direita, tabela `size="small"`
- Dialogs modais para criar/editar (largura ~420px)
- Formulários: labels pequenas muted + campos `fluid` em coluna (`form-col`)

---

### 5.5 Tela Sobre (`/sobre`)

- Scroll vertical independente
- Fundo com gradiente verde suave (diferente das outras telas)
- Hero em 2 colunas: texto institucional + card de versão do build
- Versão, commit git e data/hora do build (injetados no Vite)
- Lista cronológica de releases com badge de versão

---

### 5.6 Responsividade

| Breakpoint | Efeito principal |
|------------|------------------|
| **760px** | Header compacto (só ícones na nav); email some |
| **1100px** | Cards de resumo em 2 colunas |
| **760px** (transações) | Cards em 1 coluna; botões da actions-bar quebram linha |

---

## 6. Componentes PrimeVue usados

Importados **por arquivo** (tree-shaking):

| Componente | Onde |
|------------|------|
| `Button` | Todas as telas |
| `InputText`, `InputNumber`, `Password`, `Textarea` | Formulários |
| `Select`, `MultiSelect`, `DatePicker`, `Checkbox` | Filtros e forms |
| `DataTable`, `Column`, `Tag` | Listagens |
| `Dialog` | Modais e settings |
| `TabView`, `TabPanel` | Configurações |
| `FileUpload`, `ProgressSpinner` | Importação CSV |
| `Toast`, `ConfirmDialog` | Globais em App.vue |
| Serviços: `ToastService`, `ConfirmationService`, `useToast`, `useConfirm` | Feedback |

---

## 7. Checklist para replicar em outro projeto

### Dependências npm

```json
{
  "vue": "^3.5.12",
  "vue-router": "^4.4.5",
  "pinia": "^2.2.4",
  "primevue": "^4.1.1",
  "@primevue/themes": "^4.1.1",
  "primeicons": "^7.0.0",
  "axios": "^1.7.7"
}
```

Dev: `vite`, `@vitejs/plugin-vue`, `typescript`, `vue-tsc`.

### Passos mínimos

1. Criar app Vite + Vue + TS
2. Configurar PrimeVue com tema Aura + PrimeIcons CSS
3. Copiar/adaptar `styles.css` (shell, header, money utilities)
4. Montar `App.vue` com header de 3 zonas (marca | nav central pill | usuário)
5. Usar `#app` + `body` com `height: 100vh` e overflow hidden
6. Em telas tipo dashboard: grid `48px | 280px | 1fr` + toggle de painel lateral
7. Manter CSS scoped por view; variáveis `--p-*` para cores
8. Prop `fluid` em inputs; `:deep()` para filhos PrimeVue

### Arquivos de referência no repositório

| Arquivo | Papel |
|---------|-------|
| `apps/web/src/main.ts` | Bootstrap PrimeVue + serviços |
| `apps/web/src/styles.css` | CSS global e header |
| `apps/web/src/App.vue` | Login + header + shell |
| `apps/web/src/views/TransactionsView.vue` | Layout lateral toggle + tabela |
| `apps/web/src/views/SettingsView.vue` | TabView administrativo |
| `apps/web/src/views/AboutView.vue` | Página informativa |
| `apps/web/vite.config.ts` | Alias e proxy |

---

## 8. Resumo do “DNA visual”

- **App corporativo limpo**: branco/cinza, bordas sutis, cantos 6–12px
- **Header sempre visível** com logo quadrado + nav central estilo pill
- **Painel lateral opcional** acionado por ícones estreitos (48px), fecha ao clicar de novo
- **PrimeVue Aura** como base; customização via CSS próprio + variáveis `--p-*`
- **Sem framework CSS externo** — flexbox/grid manual
- **Feedback**: toast para erros/sucesso, confirm dialog para exclusões
- **Dados financeiros**: alinhamento à direita, tabular nums, verde/vermelho sem exagero
