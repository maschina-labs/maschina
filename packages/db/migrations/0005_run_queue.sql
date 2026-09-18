CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"machine_id" uuid NOT NULL,
	"occurrence_key" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"leased_by" uuid,
	"lease_expires_at" timestamp with time zone,
	"lease_epoch" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_occurrence" UNIQUE("machine_id","occurrence_key"),
	CONSTRAINT "runs_state_known" CHECK ("state" in ('queued', 'leased', 'done')),
	CONSTRAINT "runs_lease_complete" CHECK (("leased_by" is null and "lease_expires_at" is null) or ("leased_by" is not null and "lease_expires_at" is not null and "lease_epoch" > 0))
);
--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_due" ON "runs" USING btree ("state","due_at");