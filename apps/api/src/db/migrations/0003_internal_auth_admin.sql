ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "password_hash" text;
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;
--> statement-breakpoint
INSERT INTO "app_user" ("email", "name", "google_sub", "password_hash", "role")
VALUES (
	'farukz@gmail.com',
	'Faruk',
	'__local__:farukz@gmail.com',
	'scrypt:9SOFVXtACd6CZknz1vwLIA:6cIiHLaJy8_fw2UEbYooW5tzix7vFqMyaQzTlGOk6MBfdoKp5yUb_xJKXY29iWV3OmdMJmY5WFU0fk5TQ4afFg',
	'admin'
)
ON CONFLICT ("email") DO UPDATE SET
	"name" = EXCLUDED."name",
	"password_hash" = EXCLUDED."password_hash",
	"role" = 'admin',
	"updated_at" = now();
