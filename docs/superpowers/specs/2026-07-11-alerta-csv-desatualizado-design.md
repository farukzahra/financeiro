# Alerta CSV desatualizado (D-1)

## Regra

- CSV cobre até **ontem** (`D-1`).
- `diasDesatualizado = max(0, ontem − ultimaData)`.
- Ex.: hoje 11, última 8 → 2 dias.
- Alerta só se `dias > 0`.

## UI

Warning compacto ao lado de **Importar CSV**. Sem transações: pedir para importar.

## Dados

`ultimaData` no resumo da listagem = `MAX(data)` global do usuário (independente de filtros).
