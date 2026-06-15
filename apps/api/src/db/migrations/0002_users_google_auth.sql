CREATE TABLE IF NOT EXISTS "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"google_sub" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_email_unique" ON "app_user" USING btree ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_google_sub_unique" ON "app_user" USING btree ("google_sub");
--> statement-breakpoint
INSERT INTO "app_user" ("email", "name", "google_sub")
VALUES ('legacy@local', 'Usuario legado', '__legacy__')
ON CONFLICT ("google_sub") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app_user" ("email", "name", "google_sub", "password_hash", "role")
VALUES (
	'farukz@gmail.com',
	'Faruk',
	'__local__:farukz@gmail.com',
	'scrypt:9SOFVXtACd6CZknz1vwLIA:6cIiHLaJy8_fw2UEbYooW5tzix7vFqMyaQzTlGOk6MBfdoKp5yUb_xJKXY29iWV3OmdMJmY5WFU0fk5TQ4afFg',
	'admin'
)
ON CONFLICT ("google_sub") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "import" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "category_rule" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "budget_item" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
UPDATE "import"
SET "user_id" = (SELECT "id" FROM "app_user" WHERE "google_sub" = '__legacy__')
WHERE "user_id" IS NULL;
--> statement-breakpoint
UPDATE "transaction"
SET "user_id" = (SELECT "id" FROM "app_user" WHERE "google_sub" = '__legacy__')
WHERE "user_id" IS NULL;
--> statement-breakpoint
UPDATE "category_rule"
SET "user_id" = (SELECT "id" FROM "app_user" WHERE "google_sub" = '__legacy__')
WHERE "user_id" IS NULL;
--> statement-breakpoint
UPDATE "budget_item"
SET "user_id" = (SELECT "id" FROM "app_user" WHERE "google_sub" = '__legacy__')
WHERE "user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "import" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "transaction" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "category_rule" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "budget_item" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import" ADD CONSTRAINT "import_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "budget_item" ADD CONSTRAINT "budget_item_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS "transaction_pkey";
--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_identificador_pk" PRIMARY KEY ("user_id","identificador");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_import_user_hash" ON "import" USING btree ("user_id","hash_sha256");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rule_user_ativa_prioridade" ON "category_rule" USING btree ("user_id","ativa","prioridade");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_user_data" ON "transaction" USING btree ("user_id","data");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_user_cat_data" ON "transaction" USING btree ("user_id","categoria_id","data");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_user_chave" ON "transaction" USING btree ("user_id","chave_normalizada");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_budget_user_ativo" ON "budget_item" USING btree ("user_id","ativo");
