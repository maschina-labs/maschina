-- A trade is written down as submitted before it is sent, so a crash in between leaves a signature to
-- ask the chain about. The database keeps the list of event types it will accept, and this adds one.
ALTER TABLE "events" DROP CONSTRAINT "events_type_known";
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_type_known" CHECK ("type" in ('run.queued', 'run.started', 'run.skipped', 'run.finished', 'trade.intended', 'trade.refused', 'trade.submitted', 'trade.completed', 'trade.failed', 'machine.created', 'machine.started', 'machine.paused', 'machine.resumed', 'machine.stopped', 'machine.limits_changed', 'authority.used', 'authority.denied'));
