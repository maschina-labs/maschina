CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lease_epoch" bigint NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_machine_time" ON "events" USING btree ("machine_id","occurred_at");--> statement-breakpoint
-- The record is append only. The app role may add and read events, nothing more.
REVOKE UPDATE, DELETE, TRUNCATE ON "events" FROM maschina_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "events" TO maschina_app;--> statement-breakpoint
-- Triggers catch everyone the grants don't, including the table's owner.
CREATE FUNCTION events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'events is append only, so % is refused', TG_OP USING ERRCODE = '42501';
END;
$$;--> statement-breakpoint
CREATE TRIGGER events_no_change
	BEFORE UPDATE OR DELETE ON "events"
	FOR EACH ROW EXECUTE FUNCTION events_append_only();--> statement-breakpoint
CREATE TRIGGER events_no_truncate
	BEFORE TRUNCATE ON "events"
	FOR EACH STATEMENT EXECUTE FUNCTION events_append_only();
