# Relatório de UI — sugestões de evolução (Financeiro)

**Data:** 2026-07-11  
**Escopo:** `apps/web` (Vue 3 + Vuetify 3)  
**Lentes:** skill `frontend-design` + skill `vuetify-ui` (manter tema azul/bege existente; não reinventar a identidade do zero)  
**Audiência:** uso pessoal / doméstico — leitura rápida de extrato, orçamento e categorização

---

## 1. Leitura do produto hoje

| Eixo | Situação atual |
|------|----------------|
| **Job da tela principal** | Ver o dinheiro do período, filtrar, categorizar, importar CSV, acompanhar orçamento |
| **Identidade** | Azul `#1E5AA8` + lavagens bege/areia (`--app-accent-wash`) — direção boa e específica |
| **Tipografia** | `system-ui` / Segoe — legível, mas sem personalidade de “caderno financeiro” |
| **Layout** | Shell denso: activity bar + painel + tabela full-height — excelente para poder, frio para acolhimento |
| **Componentes** | Mistura forte: CSS próprio (header, cards, ciclo) + defaults Vuetify (`v-data-table`, `v-btn`, chips) |

**Tese sugerida (sem trocar a marca):** o produto deve parecer um **extrato bancário claro com cheiro de papel/areia**, não um dashboard SaaS genérico. O risco estético único: **números e datas como heróis tipográficos**; o resto quieto.

---

## 2. O que já está bem (não mexer sem motivo)

1. **Painéis laterais** (filtros / categorias / orçamento) — modelo de trabalho sólido.  
2. **Cards de resumo** com tooltip explicativo — pedagogia boa.  
3. **Ciclo salarial** (barra + D-1 filter) — assinatura visual útil.  
4. **Pílulas de categoria curtas** — densifica a tabela sem ruído.  
5. **Tema claro fixo** — alinhado ao uso diário de números; dark mode não é prioridade.  
6. **Regras do projeto** (sem paginação, copy em PT-BR, E2E com mock) — manter.

---

## 3. Sugestões priorizadas

### P0 — Alto impacto, baixo risco

| # | Sugestão | Por quê | Como (orientação) |
|---|----------|---------|-------------------|
| 1 | **Tipografia tabular consistente** | Valores e datas “pulam” visualmente entre card, tabela e orçamento | Fonte mono ou `font-variant-numeric: tabular-nums` + peso único nos `.value` / `money-*`; opcional: `IBM Plex Sans` (UI) + `IBM Plex Mono` (valores) via Google Fonts — ainda sóbrio, menos “system default” |
| 2 | **Hierarquia dos 4 cards** | Quatro cards iguais competem; Saldo atual e Saldo líquido merecem mais peso | Card “principal” (Saldo atual) um pouco maior / borda primary-wash; Entradas/Saídas secundários; Saldo líquido com ênfase condicional (pos/neg) |
| 3 | **Tabela: menos chrome Vuetify** | `v-data-table` striped + headers padrão ainda lembram admin template | Header sticky com fundo `surface`, zebra mais suave (`opacity` baixa), hover de linha com `--app-highlight`, sem sombra de card na tabela |
| 4 | **Estados de feedback sem kit genérico** | Você já rejeitou `v-alert` warning — o mesmo vale para snackbar “material” alto contraste se aparecer demais | Manter `AppSnackbar` / confirm, mas alinhar cores ao wash bege/azul; erros = vermelho do tema, sucesso = verde discreto, sem banners amarelos de framework |
| 5 | **Empty states com ação** | Lista vazia / filtro sem resultado / sem orçamento — hoje tendem a texto seco | Uma frase + CTA (“Importar CSV”, “Limpar filtros”, “Novo item”) — skill de copy: sem desculpas, com próximo passo |

### P1 — Identidade e leitura

| # | Sugestão | Por quê | Como |
|---|----------|---------|------|
| 6 | **Logo “C” → marca mínima** | Letra isolada não carrega o produto | Manter o tile wash azul; trocar “C” por monograma “Fi” ou ícone de extrato simples (SVG 1 cor); título “Financeiro” com tracking leve |
| 7 | **Login como composição única** | Login atual é formulário correto, mas “poderia ser qualquer app” | Fundo com gradiente suave `background → accent-wash` (não purple, não cream genérico AI); um painel único; brand hero no primeiro viewport; **sem** cards empilhados nem badges flutuantes |
| 8 | **Nav central** | Funciona; no mobile some o texto e fica só ícone — ok, mas o “pill” cinza é genérico | Opção: underline / barra inferior primary no ativo, em vez de sombra de botão elevado |
| 9 | **Settings: abas longas** | Categorias / Regras / Orçamento / Assinaturas / Preferências — densidade alta | Manter abas; reforçar `table-action-columns` em **todas** as tabelas (Categoria já tem ação única; orçamento ainda pode espremer ícones); ellipsis + `title` em descrições |
| 10 | **Copy operacional** | Textos como “Filtrar” / “Limpar” estão ok; avisos de extrato melhoraram | Padronizar glossário: Extrato, Previsto, Restante, Ciclo, D-1; evitar “warning/error” na UI — falar o problema (“Extrato atrasado…”) |

### P2 — Polish e movimento

| # | Sugestão | Por quê | Como |
|---|----------|---------|------|
| 11 | **Motion mínimo** | App financeiro: movimento deve orientar, não entreter | Transição 120–180ms em painel abrir/fechar e hover de linha; respeitar `prefers-reduced-motion` |
| 12 | **Foco teclado visível** | Já há outline em alguns cards | Unificar `:focus-visible` com `--app-primary` em botões, linhas editáveis e activity bar |
| 13 | **Densidade mobile da Transações** | Activity bar + tabela em 360px fica apertado | Stack: actions + 2 cards principais; tabela com colunas essenciais (Data, Detalhe, Valor, Categoria); Tipo/ações em menu |
| 14 | **Import CSV** | Fluxo crítico; modal denso | Wizard visual em 2 passos (arquivo → conferir); progresso com o mesmo accent-wash, não spinner genérico sem contexto |
| 15 | **Orçamento: Cartão de Crédito** | Item sistema + progresso — bom | Diferenciar visualmente itens `origem=assinaturas` (ícone cadeado / fundo wash) para não parecer bug de “não edita” |

---

## 4. Direção visual recomendada (tokens)

Manter o que já existe; só **afinar**:

| Token | Hoje | Sugestão |
|-------|------|----------|
| Primary | `#1E5AA8` | Manter |
| Accent wash | `#F3E8DE` / `#E2D0C2` | Manter como “papel” / avisos / ciclo |
| Background | `#F8FAFC` | **Mantido azul-claro** (areia `#F7F6F3` rejeitada na revisão visual) |
| Tipografia UI | system-ui | `IBM Plex Sans` 400/500/600 |
| Tipografia dados | tabular system | `IBM Plex Mono` 500 nos valores |
| Raio | `lg` nos botões, 8–12px nos cards | Padronizar **8px** superfície / **10px** controles — menos variedade = menos “template” |
| Sombra | pouca | Continuar quase flat; sombra só em overlays (tooltip, menu) |

**Assinatura visual única sugerida:** a **barra do ciclo salarial + hint de extrato D-1** no mesmo “vocabulário areia” — já começou; expandir esse idioma a vazios e avisos, e banir `v-alert` / chips warning genéricos na área de trabalho.

---

## 5. O que evitar (anti-padrões desta skill)

- Purple gradients, glow, dark mode “porque sim”.  
- Cream + serif terracotta (clichê AI #1).  
- Layout jornal hairline / zero radius (clichê AI #3).  
- Cards no hero do login; badges flutuantes; stat strips.  
- Reescrever tudo em outro UI kit — o stack Vuetify + CSS próprio já serve; o ganho está em **disciplina visual**, não em trocar biblioteca.

---

## 6. Roadmap sugerido (sem compromisso de escopo)

1. **Sprint A (1–2 dias):** tipografia dados + hierarquia dos summary cards + limpeza visual da `v-data-table`.  
2. **Sprint B:** empty states + polish login + unificar avisos (extrato, sistema orçamento).  
3. **Sprint C:** mobile Transações + import em 2 passos + foco/a11y.

Cada item acima deve nascer com E2E em `apps/web/e2e/` (regra do projeto).

---

## 7. Critério de sucesso

Uma pessoa abre Transações e, em **2 segundos**, entende: (1) quanto tem, (2) se o extrato está atrasado, (3) o que fazer depois (filtrar / importar / orçamento). Se a tela ainda parecer “admin Vuetify genérico”, o Sprint A não terminou.

---

## 8. Status de implementação (2026-07-11)

Sprint A + quick wins do Sprint B aplicados no código:

- Tipografia IBM Plex Sans/Mono + fundo `#F7F6F3`
- Hierarquia dos summary cards (Saldo atual / líquido / entradas-saídas)
- Limpeza visual da `v-data-table` (`.tx-table`)
- Empty states com CTA (lista, categorias, orçamento)
- Login com gradiente suave + monograma **Fi**
- Nav com underline primary (sem pill elevado)
- Avisos/snackbar e item de orçamento sistema no vocabulário areia
- `prefers-reduced-motion` + `:focus-visible` unificado

Ainda fora (Sprint C): mobile denso, wizard Import CSV em 2 passos.
