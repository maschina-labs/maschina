-- Secrets an owner has given us, sealed under a key that lives only in the server's environment.
-- One of each kind per owner; giving a new one replaces the old.
CREATE TABLE "owner_secrets" (
	"owner_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"sealed" text NOT NULL,
	"hint" text NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_secrets_owner_id_kind_pk" PRIMARY KEY("owner_id","kind"),
	CONSTRAINT "owner_secrets_kind_known" CHECK ("kind" in ('anthropic')),
	CONSTRAINT "owner_secrets_sealed_shape" CHECK ("sealed" ~ '^v1\.')
);
--> statement-breakpoint
ALTER TABLE "owner_secrets" ADD CONSTRAINT "owner_secrets_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE no action ON UPDATE no action;