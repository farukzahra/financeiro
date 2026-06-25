import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";
import { copyAdminConfigToNewUser } from "./services/admin-bootstrap.js";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "financeiro_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const LoginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const UserSettingsSchema = z
  .object({
    budgetOrder: z.array(z.string().uuid()).optional(),
    salaryCycle: z
      .object({
        startDay: z.number().int().nullable().optional(),
        endDay: z.number().int().nullable().optional(),
      })
      .optional(),
    transactionsFilters: z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        categories: z.array(z.string()).optional(),
        search: z.string().optional(),
        activePanel: z.enum(["filters", "cats", "budget"]).nullable().optional(),
        sortField: z
          .enum(["data", "tipo", "detalhe", "categoriaId", "valor"])
          .nullable()
          .optional(),
        sortOrder: z.union([z.literal(1), z.literal(-1)]).optional(),
      })
      .optional(),
  })
  .passthrough();

type UserSettings = z.infer<typeof UserSettingsSchema>;

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  settings: UserSettings;
};

function sessionSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret-change-me";
}

function shouldUseSecureCookie(): boolean {
  return process.env.AUTH_COOKIE_SECURE === "true";
}

function publicUser(user: typeof users.$inferSelect): CurrentUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    settings: UserSettingsSchema.parse(user.settings ?? {}),
  };
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [algorithm, salt, expected] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !expected) return false;

  const actual = scryptSync(password, salt, 64).toString("base64url");
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function createSessionToken(userId: string): string {
  const payload = base64url(
    JSON.stringify({
      userId,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    }),
  );
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      userId?: string;
      exp?: number;
    };
    if (!parsed.userId || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function setSessionCookie(reply: FastifyReply, token: string) {
  const secure = shouldUseSecureCookie() ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`,
  );
}

function clearSessionCookie(reply: FastifyReply) {
  const secure = shouldUseSecureCookie() ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`,
  );
}

export async function getCurrentUser(req: FastifyRequest): Promise<CurrentUser | null> {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const userId = token ? verifySessionToken(token) : null;
  if (!userId) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  return user ? publicUser(user) : null;
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<CurrentUser> {
  const user = await getCurrentUser(req);
  if (!user) {
    reply.code(401);
    throw new Error("Nao autenticado");
  }
  return user;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.data.email),
    });
    if (!user || !verifyPassword(body.data.password, user.passwordHash)) {
      return reply.code(401).send({ error: "Email ou senha invalidos" });
    }

    setSessionCookie(reply, createSessionToken(user.id));
    return publicUser(user);
  });

  app.post("/auth/register", async (req, reply) => {
    const body = RegisterSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const existing = await db.query.users.findFirst({
      where: eq(users.email, body.data.email),
    });
    if (existing) return reply.code(409).send({ error: "Email ja cadastrado" });

    const [created] = await db
      .insert(users)
      .values({
        email: body.data.email,
        name: body.data.name ?? null,
        googleSub: `__local__:${body.data.email}`,
        passwordHash: hashPassword(body.data.password),
        role: "user",
      })
      .returning();

    await copyAdminConfigToNewUser(created.id);

    const fresh = await db.query.users.findFirst({
      where: eq(users.id, created.id),
    });

    setSessionCookie(reply, createSessionToken(created.id));
    return publicUser(fresh ?? created);
  });

  app.get("/auth/me", async (req, reply) => {
    const user = await getCurrentUser(req);
    if (!user) return reply.code(401).send({ error: "Nao autenticado" });
    return user;
  });

  app.patch("/auth/settings", async (req, reply) => {
    const current = await requireUser(req, reply);
    const body = UserSettingsSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const existing = await db.query.users.findFirst({
      where: eq(users.id, current.id),
    });
    if (!existing) return reply.code(404).send({ error: "Usuario nao encontrado" });

    const settings = {
      ...UserSettingsSchema.parse(existing.settings ?? {}),
      ...body.data,
    };

    const [updated] = await db
      .update(users)
      .set({ settings, updatedAt: new Date() })
      .where(eq(users.id, current.id))
      .returning();

    return publicUser(updated);
  });

  app.post("/auth/logout", async (_req, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
