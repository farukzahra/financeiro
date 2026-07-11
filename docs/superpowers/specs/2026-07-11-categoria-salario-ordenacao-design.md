# Categoria SALÁRIO + desempate na lista de transações

## Problema

Não existe categoria padrão para salário. Na lista de transações, na mesma data, o lançamento de salário deve aparecer antes dos demais.

## Solução

1. Categoria global `SALARIO` (descrição `Salário`, pílula `SALÁRIO`) no seed e datapatch (dev + prod).
2. Desempate na ordenação por data: mesma `data` → `SALARIO` primeiro (rank 0), demais depois. Vale em asc e desc da data.
3. Categorias já são globais — seed/datapatch bastam para usuários novos e existentes.

## Fora de escopo

- Regra automática de categorização para salário.
- Mudar ordenação em outras colunas.

## Testes

- Unitário do comparador/rank.
- E2E: duas txs mesma data (SALÁRIO + outra); SALÁRIO aparece primeiro.
