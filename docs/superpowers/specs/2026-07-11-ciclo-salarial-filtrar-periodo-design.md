# Ciclo salarial → filtrar período (painel Orçamento)

## Problema

No painel Orçamento, o bloco do ciclo salarial mostra início, fim e dias restantes, mas não há atalho para aplicar esse intervalo ao filtro de período. O usuário precisa digitar as datas manualmente.

## Solução

Quando o ciclo salarial estiver definido (`salaryCycle` com `start` e `end`), o bloco inteiro `.salary-cycle` vira um controle clicável.

### Comportamento

1. Clique (ou Enter/Espaço com foco) no bloco:
   - Define o filtro de período como `[start, end]` do ciclo atual.
   - Dispara o mesmo fluxo de filtragem usado pelo formulário (`applyFilters` / `load`).
   - **Não** altera `activePanel` — permanece em Orçamento.
2. Sem ciclo configurado: bloco permanece só informativo (sem clique, sem `role="button"`).
3. Feedback visual: cursor pointer, estilo de link no texto (hover/underline), `title` / `aria-label` “Filtrar pelo ciclo salarial”.

### Fora de escopo

- Trocar automaticamente para a aba Filtros.
- Alterar o cálculo do ciclo ou Preferências.
- Novos endpoints de API.

## Testes

E2E Playwright com mock: abrir Orçamento → clicar no ciclo → período do formulário de filtros reflete início/fim do ciclo; painel Orçamento continua ativo; dados recarregados com o período.
