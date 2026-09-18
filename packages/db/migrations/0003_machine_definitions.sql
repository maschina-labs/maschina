CREATE TABLE "machine_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"settings" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_definitions_id_shape" CHECK ("id" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "machine_definitions_kind_shape" CHECK ("kind" ~ '^[a-z][a-z0-9_]{2,39}$')
);
--> statement-breakpoint
-- A definition is an artifact. A machine pinned to one must find it unchanged, so nobody may edit or
-- remove a version, the same rule the record lives by.
REVOKE UPDATE, DELETE, TRUNCATE ON "machine_definitions" FROM maschina_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "machine_definitions" TO maschina_app;--> statement-breakpoint
CREATE FUNCTION machine_definitions_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'a machine definition is immutable, so % is refused', TG_OP USING ERRCODE = '42501';
END;
$$;--> statement-breakpoint
CREATE TRIGGER machine_definitions_no_change
	BEFORE UPDATE OR DELETE ON "machine_definitions"
	FOR EACH ROW EXECUTE FUNCTION machine_definitions_immutable();--> statement-breakpoint
CREATE TRIGGER machine_definitions_no_truncate
	BEFORE TRUNCATE ON "machine_definitions"
	FOR EACH STATEMENT EXECUTE FUNCTION machine_definitions_immutable();
