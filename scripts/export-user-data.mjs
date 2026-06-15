import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../apps/api/package.json", import.meta.url));
const postgres = require("postgres");

const email = process.argv[2];
const output = process.argv[3] ?? `user-data-${Date.now()}.sql`;
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/financeiro";

if (!email) {
  console.error("Uso: node scripts/export-user-data.mjs <email> [arquivo.sql]");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

function q(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

const [user] = await sql`
  select id, email, settings from app_user where lower(email) = lower(${email})
`;

if (!user) {
  await sql.end();
  console.error(`Usuario nao encontrado: ${email}`);
  process.exit(1);
}

const [categories, imports, transactions, rules, budgets] = await Promise.all([
  sql`select id, letra, descricao, ativa from category order by id`,
  sql`
    select id, nome_arquivo, hash_sha256, conta, periodo_inicio::text, periodo_fim::text,
           criado_em, total_linhas, total_novas, total_duplicadas, total_importadas
    from import
    where user_id = ${user.id}
    order by criado_em, id
  `,
  sql`
    select identificador, import_id, data::text, valor::text, descricao_raw, tipo, detalhe,
           chave_normalizada, categoria_id, category_rule_id, regra_aplicada, importado_em, observacao
    from transaction
    where user_id = ${user.id}
    order by data, identificador
  `,
  sql`
    select id, categoria_id, tipo_padrao, padrao, prioridade, ativa
    from category_rule
    where user_id = ${user.id}
    order by prioridade, id
  `,
  sql`
    select id, descricao, categoria_id, dia_vencimento, valor_mensal::text, ativo, criado_em
    from budget_item
    where user_id = ${user.id}
    order by criado_em, id
  `,
]);

let out = "";
const targetUserId = `(select id from app_user where lower(email) = lower(${q(email)}))`;
out += `-- Dados exportados de ${email}\n`;
out += `-- Origem: ${databaseUrl.replace(/:[^:@/]+@/, ":***@")}\n`;
out += "begin;\n\n";
out += `do $$ begin\n`;
out += `  if not exists (select 1 from app_user where lower(email) = lower(${q(email)})) then\n`;
out += `    raise exception 'Usuario destino nao existe: ${email}';\n`;
out += `  end if;\n`;
out += `end $$;\n\n`;
out += `update app_user set settings = ${q(user.settings)}::jsonb where lower(email) = lower(${q(email)});\n\n`;

for (const c of categories) {
  out += `insert into category (id, letra, descricao, ativa) values (${q(c.id)}, ${q(c.letra)}, ${q(c.descricao)}, ${q(c.ativa)}) `;
  out += `on conflict (id) do update set letra = excluded.letra, descricao = excluded.descricao, ativa = excluded.ativa;\n`;
}

out += "\n";

for (const i of imports) {
  out += `insert into import (id, user_id, nome_arquivo, hash_sha256, conta, periodo_inicio, periodo_fim, criado_em, total_linhas, total_novas, total_duplicadas, total_importadas)\n`;
  out += `select ${q(i.id)}, ${targetUserId}, ${q(i.nome_arquivo)}, ${q(i.hash_sha256)}, ${q(i.conta)}, ${q(i.periodo_inicio)}, ${q(i.periodo_fim)}, ${q(i.criado_em.toISOString())}, ${q(i.total_linhas)}, ${q(i.total_novas)}, ${q(i.total_duplicadas)}, ${q(i.total_importadas)}\n`;
  out += `on conflict (id) do update set user_id = excluded.user_id, nome_arquivo = excluded.nome_arquivo, hash_sha256 = excluded.hash_sha256, conta = excluded.conta, periodo_inicio = excluded.periodo_inicio, periodo_fim = excluded.periodo_fim, total_linhas = excluded.total_linhas, total_novas = excluded.total_novas, total_duplicadas = excluded.total_duplicadas, total_importadas = excluded.total_importadas;\n`;
}

out += "\n";

for (const r of rules) {
  out += `insert into category_rule (id, user_id, categoria_id, tipo_padrao, padrao, prioridade, ativa)\n`;
  out += `select ${q(r.id)}, ${targetUserId}, ${q(r.categoria_id)}, ${q(r.tipo_padrao)}, ${q(r.padrao)}, ${q(r.prioridade)}, ${q(r.ativa)}\n`;
  out += `on conflict (id) do update set user_id = excluded.user_id, categoria_id = excluded.categoria_id, tipo_padrao = excluded.tipo_padrao, padrao = excluded.padrao, prioridade = excluded.prioridade, ativa = excluded.ativa;\n`;
}

out += "\n";

for (const b of budgets) {
  out += `insert into budget_item (id, user_id, descricao, categoria_id, dia_vencimento, valor_mensal, ativo, criado_em)\n`;
  out += `select ${q(b.id)}, ${targetUserId}, ${q(b.descricao)}, ${q(b.categoria_id)}, ${q(b.dia_vencimento)}, ${q(b.valor_mensal)}, ${q(b.ativo)}, ${q(b.criado_em.toISOString())}\n`;
  out += `on conflict (id) do update set user_id = excluded.user_id, descricao = excluded.descricao, categoria_id = excluded.categoria_id, dia_vencimento = excluded.dia_vencimento, valor_mensal = excluded.valor_mensal, ativo = excluded.ativo;\n`;
}

out += "\n";

for (const t of transactions) {
  out += `insert into transaction (identificador, user_id, import_id, data, valor, descricao_raw, tipo, detalhe, chave_normalizada, categoria_id, category_rule_id, regra_aplicada, importado_em, observacao)\n`;
  out += `select ${q(t.identificador)}, ${targetUserId}, ${q(t.import_id)}, ${q(t.data)}, ${q(t.valor)}, ${q(t.descricao_raw)}, ${q(t.tipo)}, ${q(t.detalhe)}, ${q(t.chave_normalizada)}, ${q(t.categoria_id)}, ${q(t.category_rule_id)}, ${q(t.regra_aplicada)}, ${q(t.importado_em.toISOString())}, ${q(t.observacao)}\n`;
  out += `on conflict (user_id, identificador) do update set import_id = excluded.import_id, data = excluded.data, valor = excluded.valor, descricao_raw = excluded.descricao_raw, tipo = excluded.tipo, detalhe = excluded.detalhe, chave_normalizada = excluded.chave_normalizada, categoria_id = excluded.categoria_id, category_rule_id = excluded.category_rule_id, regra_aplicada = excluded.regra_aplicada, observacao = excluded.observacao;\n`;
}

out += "\ncommit;\n";

fs.writeFileSync(output, out, "utf8");
await sql.end();

console.log(
  JSON.stringify(
    {
      output,
      email,
      categories: categories.length,
      imports: imports.length,
      transactions: transactions.length,
      rules: rules.length,
      budgetItems: budgets.length,
    },
    null,
    2,
  ),
);
