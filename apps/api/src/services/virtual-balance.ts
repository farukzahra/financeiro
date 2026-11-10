import { eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "../db/client.js";
import { transactions, users } from "../db/schema.js";

/** Saldo do aplicativo: soma de todas as transações (sem filtro). */
export async function getSystemBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({
      saldo: drizzleSql<string>`coalesce(sum(${transactions.valor}), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  return Number(row?.saldo ?? 0);
}

/**
 * Reancora o saldo do banco virtual no saldo atual do aplicativo.
 * Chamado quando entram dados novos (importação, lançamento manual) ou
 * quando tudo é apagado. A diferença volta a zero até o usuário reconciliar
 * manualmente de novo.
 */
export async function syncVirtualBalanceToSystem(userId: string): Promise<string> {
  const formatted = (await getSystemBalance(userId)).toFixed(2);
  const [user] = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return formatted;

  await db
    .update(users)
    .set({
      settings: { ...(user.settings ?? {}), saldoBancoVirtual: formatted },
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return formatted;
}
