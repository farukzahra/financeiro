# Plano: Categorias 1:1 com Orçamento Previsto

**Problema:** hoje, budget items como Unimed usam a categoria `SAUDE`, que também
captura outras transações de saúde (consultas, exames). Isso distorce o "gasto vs previsto"
porque o painel soma tudo que é `SAUDE`, não só o que é Unimed.

**Objetivo:** cada budget item orçado deve ter uma categoria exclusiva, de forma que
`gasto da categoria = gasto contra aquele item de orçamento`.

---

## Estado atual dos budget items

| # | Descrição            | Categoria atual  | Previsto/mês | Status       |
|---|----------------------|------------------|--------------|--------------|
| 1 | Celular Faruk + Rima | *(nenhuma)*      | R$ 150,00    | ❌ sem cat   |
| 2 | Celular Khalil       | *(nenhuma)*      | R$ 70,00     | ❌ sem cat   |
| 3 | Dentista Khalil      | *(nenhuma)*      | R$ 200,00    | ❌ sem cat   |
| 4 | Empregada            | *(nenhuma)*      | R$ 0,00      | ❌ sem cat   |
| 5 | Farmacia             | `FARMACIA`       | R$ 500,00    | ⚠️ ver nota  |
| 6 | Gas                  | *(nenhuma)*      | R$ 200,00    | ❌ sem cat   |
| 7 | Gasolina             | `GASOLINA`       | R$ 1.500,00  | ✅ 1:1 ok   |
| 8 | Imposto              | *(nenhuma)*      | R$ 133,20    | ❌ sem cat   |
| 9 | Internet             | *(nenhuma)*      | R$ 150,00    | ❌ sem cat   |
|10 | Luz                  | *(nenhuma)*      | R$ 600,00    | ❌ sem cat   |
|11 | Mercado e Alim.      | `ALIMENTACAO`    | R$ 5.500,00  | ⚠️ ver nota  |
|12 | Unimed               | `SAUDE`          | R$ 1.500,00  | ❌ errado   |

---

## Decisões a tomar

### 1. Celular — juntar ou separar?

- **Opção A — uma categoria `CELULAR`** compartilhada por ambos os itens de orçamento
  - Pro: mais simples, fatura Claro/Vivo aparece só uma vez
  - Contra: não dá para ver Faruk vs Khalil separado no painel
- **Opção B — duas categorias `CELULAR FARUK` e `CELULAR KHALIL`**
  - Pro: controle individual
  - Contra: no extrato Nubank, provavelmente vêm na mesma linha "TIM" ou "CLARO"
    e seria difícil separar automaticamente

> **Sugestão:** Opção A — uma categoria `CELULAR`. O budget previsto total seria
> R$ 220,00 (150 + 70) e o gasto seria a soma das duas faturas.
> Se quiser separar, criar dois itens com lógica de merchant.

---

### 2. Farmacia — manter `FARMACIA`?

- Hoje `FARMACIA` já é dedicada ao budget "Farmacia" ✅
- O risco é que compras de higiene/beleza em farmácia também caiam em `FARMACIA`
- **Sugestão:** manter `FARMACIA` como está. Alertas de "estouro" já existem.

---

### 3. Mercado e Alim. — `ALIMENTACAO` inclui restaurantes

- Hoje `ALIMENTACAO` captura tanto mercado quanto restaurante/delivery
- O budget de R$ 5.500 provavelmente é só mercado
- **Decisão a fazer:**
  - **A)** Manter `ALIMENTACAO` cobrindo tudo (mercado + restaurante)
    e ajustar o valor previsto para incluir restaurantes também
  - **B)** Criar categoria `RESTAURANTE` separada e `ALIMENTACAO` fica só mercado
  - **C)** Renomear o budget item para "Alimentação geral" e aceitar que captura os dois

> **Sugestão:** Opção A por enquanto — ajustar o previsto para R$ 6.000+ e
> aceitar que é "alimentação total". Pode-se refinar depois.

---

### 4. Unimed — NÃO pode usar `SAUDE`

- `SAUDE` vai continuar existindo para consultas, exames, dentista sem orçamento específico
- Unimed precisa de categoria exclusiva `UNIMED`
- No extrato, o débito provavelmente aparece como "UNIMED" ou "AMS" — a regra de
  categorização automática já deve estar apontando para `SAUDE`; precisará ser
  atualizada para `UNIMED`

---

## Mapeamento final (EXECUTADO)

| Budget item    | Categoria       | Status                                |
|----------------|-----------------|---------------------------------------|
| Celular        | `CELULAR`       | ✅ criada + vinculada (era "Celular Faruk + Rima") |
| Celular Khalil | `CELULAR`       | ✅ compartilha mesma categoria         |
| Dentista Khalil| `DENTISTA`      | ✅ criada + vinculada                  |
| Empregada      | `EMPREGADA`     | ✅ criada + vinculada                  |
| Farmacia       | `FARMACIA`      | ✅ já existia, mantida                 |
| Gas            | `GAS`           | ✅ criada + vinculada                  |
| Gasolina       | `GASOLINA`      | ✅ já existia, mantida                 |
| Imposto        | `IMPOSTO`       | ✅ criada + vinculada                  |
| Internet       | `INTERNET`      | ✅ criada + vinculada                  |
| Luz            | `LUZ`           | ✅ criada + vinculada                  |
| Alimentacao    | `ALIMENTACAO`   | ✅ mantida (era "Mercado e Alim.")     |
| Unimed         | `UNIMED`        | ✅ criada + vinculada (era `SAUDE`)    |

---

## Pendente

- [ ] Atualizar regras de categorização automática (`scripts/legacy/autofill_categorias.py` / merchants)
      para que transações Unimed vão para `UNIMED` em vez de `SAUDE`
- [ ] Recategorizar transações históricas em `SAUDE` que sejam do Unimed
