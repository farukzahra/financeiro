ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS "transaction_categoria_id_category_id_fk";
--> statement-breakpoint
ALTER TABLE "category_rule" DROP CONSTRAINT IF EXISTS "category_rule_categoria_id_category_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_item" DROP CONSTRAINT IF EXISTS "budget_item_categoria_id_category_id_fk";
--> statement-breakpoint
ALTER TABLE "category" RENAME COLUMN "id" TO "code";
--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;
--> statement-breakpoint
ALTER TABLE "category" DROP CONSTRAINT "category_pkey";
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_pkey" PRIMARY KEY ("id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_category_code_unique" ON "category" ("code");
--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "categoria_id_uuid" uuid;
--> statement-breakpoint
UPDATE "transaction" t
SET "categoria_id_uuid" = c."id"
FROM "category" c
WHERE t."categoria_id" = c."code";
--> statement-breakpoint
ALTER TABLE "transaction" DROP COLUMN "categoria_id";
--> statement-breakpoint
ALTER TABLE "transaction" RENAME COLUMN "categoria_id_uuid" TO "categoria_id";
--> statement-breakpoint
ALTER TABLE "transaction" ALTER COLUMN "categoria_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "category_rule" ADD COLUMN "categoria_id_uuid" uuid;
--> statement-breakpoint
UPDATE "category_rule" r
SET "categoria_id_uuid" = c."id"
FROM "category" c
WHERE r."categoria_id" = c."code";
--> statement-breakpoint
ALTER TABLE "category_rule" DROP COLUMN "categoria_id";
--> statement-breakpoint
ALTER TABLE "category_rule" RENAME COLUMN "categoria_id_uuid" TO "categoria_id";
--> statement-breakpoint
ALTER TABLE "category_rule" ALTER COLUMN "categoria_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "budget_item" ADD COLUMN "categoria_id_uuid" uuid;
--> statement-breakpoint
UPDATE "budget_item" b
SET "categoria_id_uuid" = c."id"
FROM "category" c
WHERE b."categoria_id" = c."code";
--> statement-breakpoint
ALTER TABLE "budget_item" DROP COLUMN "categoria_id";
--> statement-breakpoint
ALTER TABLE "budget_item" RENAME COLUMN "categoria_id_uuid" TO "categoria_id";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_categoria_id_category_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_categoria_id_category_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "budget_item" ADD CONSTRAINT "budget_item_categoria_id_category_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
