CREATE TABLE "trader_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trader_runs_mode_known" CHECK ("mode" in ('paper')),
	CONSTRAINT "trader_runs_status_known" CHECK ("status" in ('running', 'paused', 'stopped'))
);
--> statement-breakpoint
ALTER TABLE "trader_runs" ADD CONSTRAINT "trader_runs_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trader_runs_owner" ON "trader_runs" USING btree ("owner_id","created_at");