ALTER TABLE "shows" ADD COLUMN "auto_number_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "auto_number_start" integer DEFAULT 1 NOT NULL;