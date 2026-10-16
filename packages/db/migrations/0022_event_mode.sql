-- Every event says whether it was paper or real money, and the database decides which.
--
-- Until now the only thing separating a simulated trade from a real one was which event type the
-- application chose to write. That is a convention, and a convention is not a guarantee: one wrong
-- branch and a paper trade is indistinguishable from a real one in the record anybody reads.
--
-- So the mode is not supplied by the caller at all. It is read from the machine's own `paper` flag in
-- the same statement that writes the event, which means no code path can get it wrong and none has to
-- remember to try.

ALTER TABLE "events" ADD COLUMN "mode" text;--> statement-breakpoint

-- Filling it in for everything already written. The record refuses UPDATE, including from the table's
-- owner, so its own trigger is stood down for exactly this statement and put straight back. This is
-- the one time that is ever done: afterwards the column is set on insert and never changes.
ALTER TABLE "events" DISABLE TRIGGER "events_no_change";--> statement-breakpoint
UPDATE "events" SET "mode" = CASE WHEN "machines"."paper" THEN 'paper' ELSE 'live' END
	FROM "machines" WHERE "machines"."id" = "events"."machine_id";--> statement-breakpoint
-- An event whose machine is gone cannot be asked. It is read as real money, because that is the
-- answer that understates nothing: a paper trade shown as real is an embarrassment, a real trade shown
-- as paper is a lie about where money went.
UPDATE "events" SET "mode" = 'live' WHERE "mode" IS NULL;--> statement-breakpoint
ALTER TABLE "events" ENABLE TRIGGER "events_no_change";--> statement-breakpoint

ALTER TABLE "events" ALTER COLUMN "mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_mode_known" CHECK ("mode" in ('paper', 'live'));--> statement-breakpoint
CREATE INDEX "events_machine_mode" ON "events" USING btree ("machine_id","mode");--> statement-breakpoint

-- The mode comes from the machine, every time, whatever the caller said.
--
-- It also refuses the two things that would make the record lie: a machine on paper producing one of
-- the events that only exist because something was signed and sent, and a live machine producing a
-- simulated trade. Those are not style rules. They are the difference between a record somebody can
-- trust and a list of claims.
CREATE FUNCTION events_mode_from_machine() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE on_paper boolean;
BEGIN
	SELECT "paper" INTO on_paper FROM "machines" WHERE "id" = NEW."machine_id";

	-- No machine to ask. `events.machine_id` has no foreign key yet, so this is reachable, and the
	-- answer that understates nothing is real money: a paper trade shown as real is an embarrassment,
	-- a real trade shown as paper is a lie about where money went. The type rules below are skipped,
	-- because without a machine there is nothing to say what it was allowed to do. Once the foreign
	-- key exists this branch becomes a refusal instead; it is written down in TECH_DEBT.
	IF on_paper IS NULL THEN
		NEW."mode" := 'live';
		RETURN NEW;
	END IF;

	NEW."mode" := CASE WHEN on_paper THEN 'paper' ELSE 'live' END;

	IF on_paper AND NEW."type" IN ('trade.submitted', 'trade.completed', 'trade.failed') THEN
		RAISE EXCEPTION 'a machine on paper signs nothing, so % is refused', NEW."type"
			USING ERRCODE = '42501';
	END IF;

	IF NOT on_paper AND NEW."type" = 'trade.simulated' THEN
		RAISE EXCEPTION 'a machine trading real money never simulates, so % is refused', NEW."type"
			USING ERRCODE = '42501';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "events_mode_decided_here"
	BEFORE INSERT ON "events"
	FOR EACH ROW EXECUTE FUNCTION events_mode_from_machine();--> statement-breakpoint

-- A machine never changes between pretending and spending.
--
-- The whole guarantee above rests on `paper` meaning the same thing for the life of a machine. If it
-- could be flipped, every event written before the flip would describe a different machine from the
-- one the record now claims, and the history would be worthless.
CREATE FUNCTION machines_paper_is_decided_once() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW."paper" IS DISTINCT FROM OLD."paper" THEN
		RAISE EXCEPTION 'a machine is made on paper or with money and never changes'
			USING ERRCODE = '42501';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "machines_paper_never_changes"
	BEFORE UPDATE ON "machines"
	FOR EACH ROW EXECUTE FUNCTION machines_paper_is_decided_once();--> statement-breakpoint

-- Nothing decides this quietly any more: the application requires it, so the column stops offering an
-- answer of its own.
ALTER TABLE "machines" ALTER COLUMN "paper" DROP DEFAULT;
