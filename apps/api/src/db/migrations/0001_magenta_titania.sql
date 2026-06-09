CREATE TABLE IF NOT EXISTS "budget_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"descricao" text NOT NULL,
	"categoria_id" text,
	"dia_vencimento" integer,
	"valor_mensal" numeric(14, 2) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "budget_item" ADD CONSTRAINT "budget_item_categoria_id_category_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
