-- Which alerts have been told to their owner, and where: one row per event per channel, written once
-- the message is out, so a restart never tells anybody the same thing twice.
CREATE TABLE "deliveries" (
	"event_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_event_id_channel_pk" PRIMARY KEY("event_id","channel"),
	CONSTRAINT "deliveries_channel_known" CHECK ("channel" in ('telegram'))
);
--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Written once and never changed: a delivery that happened stays happened.
REVOKE UPDATE, DELETE, TRUNCATE ON "deliveries" FROM maschina_app;--> statement-breakpoint
GRANT SELECT, INSERT ON "deliveries" TO maschina_app;
