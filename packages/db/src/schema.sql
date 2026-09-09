-- Slice 0: the event log.
--
-- 02-CORE §7: the event log is the only durable state. Everything else in
-- Maschina is a projection over this table and can be deleted and rebuilt.
--
-- 02-CORE §3.5, non-negotiable properties: append-only, never edited, never
-- deleted, totally ordered per worker and causally ordered globally.
--
-- Those properties are enforced here in two independent layers rather than
-- trusted to the application:
--
--   1. GRANTS      the application role holds INSERT and SELECT and nothing else
--   2. TRIGGERS    UPDATE, DELETE and TRUNCATE raise, for every role including
--                  the owner and superusers
--
-- Layer 1 alone would be defeated by connecting as the owner. Layer 2 alone
-- would be defeated by dropping the trigger. Both together mean that removing
-- append-only is a deliberate, visible schema change and never an accident.
-- This mirrors 06-NODES §5's egress rule, which is also enforced twice.

BEGIN;

-- ── The application role ─────────────────────────────────────────────────────
-- Created idempotently so `db init` can be re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'maschina_app') THEN
    CREATE ROLE maschina_app LOGIN PASSWORD 'maschina_app';
  END IF;
END
$$;

-- ── The log ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  -- Monotonic. IDENTITY rather than SERIAL: the sequence cannot be overridden
  -- by an INSERT that supplies its own id, so ordering cannot be forged.
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- 02-CORE §3.5 calls this `timestamp`. Renamed to avoid quoting a reserved
  -- word at every call site. Same field, different spelling.
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Which worker, node, or human caused this. Free text at Stage 0; becomes a
  -- principal reference once workers exist (slice 2).
  actor       TEXT        NOT NULL CHECK (length(actor) > 0),

  -- What this was in service of. Null until objectives exist (slice 1).
  objective   TEXT,

  -- What kind of fact this records. Taxonomy in 02-CORE §3.5; deliberately not
  -- an enum, because a closed type here would need a migration per event kind
  -- and 03-RUNTIME open question 4 has not been answered yet.
  type        TEXT        NOT NULL CHECK (length(type) > 0),

  payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Lease generation, for fencing. Always 0 until leases exist (slice 5).
  epoch       BIGINT      NOT NULL DEFAULT 0 CHECK (epoch >= 0),

  -- The event that caused this one. Self-referencing, so causal chains are
  -- walkable in SQL without a separate structure.
  causation   BIGINT      REFERENCES events (id)
);

CREATE INDEX IF NOT EXISTS events_objective_idx ON events (objective, id);
CREATE INDEX IF NOT EXISTS events_actor_idx     ON events (actor, id);
CREATE INDEX IF NOT EXISTS events_causation_idx ON events (causation);

-- ── Layer 2: immutability, enforced for every role ───────────────────────────

CREATE OR REPLACE FUNCTION events_is_append_only() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'events is append-only: % is forbidden (02-CORE 3.5)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS events_no_update   ON events;
DROP TRIGGER IF EXISTS events_no_delete   ON events;
DROP TRIGGER IF EXISTS events_no_truncate ON events;

CREATE TRIGGER events_no_update
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION events_is_append_only();

CREATE TRIGGER events_no_delete
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION events_is_append_only();

CREATE TRIGGER events_no_truncate
  BEFORE TRUNCATE ON events
  FOR EACH STATEMENT EXECUTE FUNCTION events_is_append_only();

-- ── Fencing: a stale lease cannot write ──────────────────────────────────────
--
-- 03-RUNTIME §4. A worker runs on a node under a lease carrying a monotonically
-- increasing epoch. Every write carries the writing lease's epoch, and the log
-- rejects any write below the highest epoch seen for that actor. When a lease is
-- reassigned the epoch increments, and the old node, if it is alive after all,
-- finds out on its next write and stops.
--
-- **This is in the database on purpose.** The whole scenario is a node that has
-- lost its lease and does not know it. A node in that state cannot be trusted to
-- check whether it is still the leaseholder, because it believes it is. The
-- check has to be somewhere the node cannot reason about, for the same reason
-- append-only is enforced here rather than by asking callers not to delete.
--
-- Equal epochs are allowed. The current leaseholder writes at its own epoch
-- repeatedly, and only a *lower* epoch means a fenced writer.

CREATE INDEX IF NOT EXISTS events_actor_epoch_idx ON events (actor, epoch DESC);

CREATE OR REPLACE FUNCTION events_fence() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  highest BIGINT;
BEGIN
  SELECT max(epoch) INTO highest FROM events WHERE actor = NEW.actor;

  IF highest IS NOT NULL AND NEW.epoch < highest THEN
    RAISE EXCEPTION
      'fenced: % wrote at epoch % but epoch % has been seen (03-RUNTIME 4)',
      NEW.actor, NEW.epoch, highest
      USING ERRCODE = 'MZFEN';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_fenced ON events;

CREATE TRIGGER events_fenced
  BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION events_fence();

-- ── Layer 1: the application role holds no destructive grant ─────────────────

GRANT CONNECT ON DATABASE maschina TO maschina_app;
GRANT USAGE   ON SCHEMA public     TO maschina_app;

-- Start from nothing, then grant back exactly two verbs. There is no UPDATE and
-- no DELETE to forget to revoke later.
REVOKE ALL     ON events FROM maschina_app;
GRANT  SELECT  ON events TO   maschina_app;

-- INSERT is granted per column, and `id` is deliberately not in the list.
--
-- GENERATED ALWAYS is not sufficient on its own: any role holding table-level
-- INSERT can defeat it with `INSERT ... OVERRIDING SYSTEM VALUE`, supply its own
-- id, and break both the ordering guarantee and the sequence. Postgres suggests
-- exactly that in the error hint. Withholding the column-level privilege is what
-- actually closes it. OVERRIDING SYSTEM VALUE then fails on permissions before
-- it can override anything.
--
-- `recorded_at` is withheld for the same reason: the log assigns time, not the
-- caller.
GRANT INSERT (actor, objective, type, payload, epoch, causation)
  ON events TO maschina_app;

-- No sequence grant is needed: an IDENTITY column's sequence is advanced
-- internally by the INSERT, so the role never touches it directly.
--
-- Honest limit: the schema owner can still drop these triggers and grants, and
-- 12-SECURITY §2 already accepts that the control plane is trusted and its
-- compromise is total. What is defended here is accident and application bugs,
-- which is the realistic failure, not a hostile owner.

COMMIT;
