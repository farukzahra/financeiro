CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category" (
	"id" text PRIMARY KEY NOT NULL,
	"letra" text NOT NULL,
	"descricao" text NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria_id" text NOT NULL,
	"tipo_padrao" text NOT NULL,
	"padrao" text NOT NULL,
	"prioridade" integer DEFAULT 100 NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome_arquivo" text NOT NULL,
	"hash_sha256" text NOT NULL,
	"conta" text NOT NULL,
	"periodo_inicio" date NOT NULL,
	"periodo_fim" date NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"total_linhas" integer DEFAULT 0 NOT NULL,
	"total_novas" integer DEFAULT 0 NOT NULL,
	"total_duplicadas" integer DEFAULT 0 NOT NULL,
	"total_importadas" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction" (
	"identificador" text PRIMARY KEY NOT NULL,
	"import_id" uuid NOT NULL,
	"data" date NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	"descricao_raw" text NOT NULL,
	"tipo" text NOT NULL,
	"detalhe" text DEFAULT '' NOT NULL,
	"chave_normalizada" text NOT NULL,
	"categoria_id" text NOT NULL,
	"category_rule_id" uuid,
	"regra_aplicada" text NOT NULL,
	"importado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"observacao" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_categoria_id_category_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_import_id_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."import"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_categoria_id_category_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_category_rule_id_category_rule_id_fk" FOREIGN KEY ("category_rule_id") REFERENCES "public"."category_rule"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rule_ativa_prioridade" ON "category_rule" USING btree ("ativa","prioridade");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_data" ON "transaction" USING btree ("data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_cat_data" ON "transaction" USING btree ("categoria_id","data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_chave" ON "transaction" USING btree ("chave_normalizada");