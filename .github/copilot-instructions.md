# Copilot instructions — financeiro

Regras de projeto que o agente deve respeitar em toda alteracao.

## Banco de dados

- **Toda mudanca em schema/tabelas/colunas/indices/constraints exige uma migracao
  versionada.** Nunca alterar o banco direto via SQL manual ou via `db push`
  silencioso. O fluxo padrao e:
  1. Editar o schema (TypeScript em `apps/api/src/db/schema.ts` quando o backend
     existir; antes disso, descrever a mudanca no PR).
  2. Gerar a migracao com `pnpm drizzle-kit generate` (ou equivalente).
  3. Revisar o SQL gerado.
  4. Aplicar com `pnpm drizzle-kit migrate`.
  5. Commitar **schema + migracao + qualquer seed/data fix** juntos no mesmo
     commit.
- Migracoes ja aplicadas em ambientes compartilhados **nao podem ser editadas**.
  Para corrigir, criar uma nova migracao.
- Nao usar `drizzle-kit push` em producao. Em dev, evitar tambem para nao
  divergir do historico.
- Seeds (categorias padrao, regras iniciais) sao scripts idempotentes em
  `apps/api/src/db/seeds/` e ficam fora do diretorio de migracoes.

## Geral

- Sempre que mexer em algo que afete o `PLANO_SISTEMA.md`, atualizar o doc
  no mesmo PR.
- Saidas para o usuario em pt-BR; codigo, identificadores e comentarios em
  ingles (exceto quando o dominio for em pt-BR, como `categoria`).
