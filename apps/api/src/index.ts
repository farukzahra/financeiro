import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { registerAuthRoutes } from "./auth.js";
import { registerImportsRoutes } from "./routes/imports.js";
import { registerTransactionsRoutes } from "./routes/transactions.js";
import { registerCategoriesRoutes } from "./routes/categories.js";
import { registerRulesRoutes } from "./routes/rules.js";
import { registerBudgetRoutes } from "./routes/budget.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.get("/health", async () => ({ ok: true }));

  await registerAuthRoutes(app);
  await registerImportsRoutes(app);
  await registerTransactionsRoutes(app);
  await registerCategoriesRoutes(app);
  await registerRulesRoutes(app);
  await registerBudgetRoutes(app);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
