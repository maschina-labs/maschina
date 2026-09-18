CREATE TABLE "machines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"wallet_address" text NOT NULL,
	"provider_wallet_id" text NOT NULL,
	"provider" text NOT NULL,
	"definition_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machines_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "machines_wallet_address_shape" CHECK ("wallet_address" ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
	CONSTRAINT "machines_provider_known" CHECK ("provider" in ('turnkey', 'crossmint')),
	CONSTRAINT "machines_name_length" CHECK (length("name") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_definition_id_machine_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."machine_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "machines_owner" ON "machines" USING btree ("owner_id");