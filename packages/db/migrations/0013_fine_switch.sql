CREATE TABLE "halts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"engaged_by" text NOT NULL,
	"engaged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"released_by" text,
	CONSTRAINT "halts_reason_given" CHECK (length("reason") between 1 and 500),
	CONSTRAINT "halts_release_complete" CHECK (("released_at" is null and "released_by" is null) or ("released_at" is not null and "released_by" is not null))
);
--> statement-breakpoint
CREATE INDEX "halts_in_force" ON "halts" USING btree ("released_at");