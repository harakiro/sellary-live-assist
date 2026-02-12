CREATE TYPE "public"."integration_provider" AS ENUM('stripe', 'shopify', 'square', 'medusajs');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'void', 'error');--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'unmatched' AND enumtypid = 'public.claim_status'::regtype) THEN ALTER TYPE "public"."claim_status" ADD VALUE 'unmatched'; END IF; END $$;--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"status" "integration_status" DEFAULT 'inactive' NOT NULL,
	"display_name" varchar(255),
	"credentials_enc" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"connected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"show_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"external_id" varchar(255),
	"external_url" text,
	"buyer_handle" varchar(255),
	"buyer_platform_id" varchar(255),
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"amount_cents" integer,
	"currency" varchar(3) DEFAULT 'usd',
	"line_items" jsonb,
	"error_message" text,
	"sent_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "claims" ALTER COLUMN "show_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "show_items" ADD COLUMN IF NOT EXISTS "price" integer;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_workspace_provider_idx" ON "integrations" USING btree ("workspace_id","provider");--> statement-breakpoint
CREATE INDEX "invoices_show_status_idx" ON "invoices" USING btree ("show_id","status");--> statement-breakpoint
CREATE INDEX "invoices_workspace_created_idx" ON "invoices" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_external_id_idx" ON "invoices" USING btree ("external_id");