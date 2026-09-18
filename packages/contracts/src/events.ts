/**
 * Every event the permanent record can hold, and the shape of its payload.
 *
 * The record is the only source of truth: machine state, budgets and track records are all worked out
 * from these events. A payload that was written wrong can never be corrected, because the record is
 * append only, so every event is checked against its schema before it is written.
 *
 * Payloads refuse unknown fields on purpose. A typo in a field name would otherwise be recorded
 * forever and silently ignored by every reader.
 */

import { z } from "zod";

/** An id, as used everywhere in Maschina: a v7 UUID, so ids sort by when they were made. */
const id = z
	.string()
	.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, "not a v7 id");

/** A token amount in its smallest unit, as a string, since JSON numbers can't hold them exactly. */
const amount = z.string().regex(/^\d+$/, "not a whole number of base units");

/** A Solana address or transaction signature, checked properly when it reaches the chain. */
const base58 = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "not base58");
const address = base58.min(32).max(44);
const signature = base58.min(64).max(88);

const object = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);

const RUN_PAYLOADS = {
	"run.queued": object({
		runId: id,
		scheduledFor: z.iso.datetime(),
		/** Identifies the occurrence, so the same scheduled run can never be queued twice. */
		occurrenceKey: z.string().min(1),
	}),
	"run.started": object({ runId: id, nodeId: id }),
	"run.skipped": object({
		runId: id,
		reason: z.enum([
			"machine_paused",
			"machine_stopped",
			"budget_exhausted",
			"missed_window",
			"provider_unavailable",
			"other",
		]),
		detail: z.string().max(500).optional(),
	}),
	"run.finished": object({
		runId: id,
		outcome: z.enum(["completed", "failed"]),
		durationMs: z.int().nonnegative(),
	}),
};

const TRADE_PAYLOADS = {
	"trade.intended": object({
		runId: id,
		tradeId: id,
		inputMint: address,
		outputMint: address,
		inputAmount: amount,
		quotedOutputAmount: amount,
		slippageBps: z.int().min(0).max(10_000),
		/**
		 * Held back for the network fee on top of the amount being spent. A trade costs what it spends
		 * plus what it costs to send, and a budget that only counts the first slowly drifts.
		 */
		feeAllowance: amount.optional(),
	}),
	"trade.refused": object({
		runId: id,
		tradeId: id,
		/** Maschina's own rules, or the wallet provider's policy. Both refuse independently. */
		by: z.enum(["maschina", "provider"]),
		rule: z.string().min(1).max(100),
		reason: z.string().min(1).max(500),
	}),
	/**
	 * Signed, and about to be sent. Written before the transaction reaches the chain, so a crash in
	 * between leaves a signature to ask the chain about rather than a question nobody can answer.
	 */
	"trade.submitted": object({
		runId: id,
		tradeId: id,
		signature,
		/** After this height the transaction can never land, which is how "it failed" becomes provable. */
		lastValidBlockHeight: amount,
	}),
	"trade.completed": object({
		runId: id,
		tradeId: id,
		signature,
		inputAmount: amount,
		outputAmount: amount,
		feeLamports: amount,
	}),
	"trade.failed": object({
		runId: id,
		tradeId: id,
		stage: z.enum(["quote", "sign", "submit", "confirm"]),
		reason: z.string().min(1).max(500),
		signature: signature.optional(),
	}),
};

const MACHINE_PAYLOADS = {
	"machine.created": object({
		ownerId: id,
		/** The content-addressed definition version the machine is pinned to. */
		definitionVersionId: z.string().regex(/^[0-9a-f]{64}$/, "not a definition version"),
		walletAddress: address,
	}),
	"machine.started": object({}),
	"machine.paused": object({
		reason: z.enum([
			"owner",
			"repeated_failures",
			"budget_exhausted",
			"provider_unavailable",
			"other",
		]),
		detail: z.string().max(500).optional(),
	}),
	"machine.resumed": object({}),
	"machine.stopped": object({
		by: z.enum(["owner", "system"]),
		reason: z.string().max(500).optional(),
	}),
	"machine.limits_changed": object({
		limit: z.enum(["maxPerTrade", "maxPerDay", "budgetGranted", "approvedMints", "recipients"]),
		/** The old and new values as text, so every limit is recorded the same way. */
		from: z.string().max(500).nullable(),
		to: z.string().max(500),
	}),
};

const AUTHORITY_PAYLOADS = {
	"authority.used": object({
		action: z.enum(["sign_transaction", "spend_budget", "change_limits", "withdraw"]),
		runId: id.optional(),
		amount: amount.optional(),
	}),
	"authority.denied": object({
		action: z.enum(["sign_transaction", "spend_budget", "change_limits", "withdraw"]),
		rule: z.string().min(1).max(100),
		reason: z.string().min(1).max(500),
	}),
};

const PAYLOADS = {
	...RUN_PAYLOADS,
	...TRADE_PAYLOADS,
	...MACHINE_PAYLOADS,
	...AUTHORITY_PAYLOADS,
} as const;

export type EventType = keyof typeof PAYLOADS;

/** Every event type, in the order they are defined. The database refuses any type not in this list. */
export const EVENT_TYPES = Object.keys(PAYLOADS) as readonly EventType[];

/** The payload schema for one event type, for a reader that handles a single kind. */
export const eventPayload = <T extends EventType>(type: T): (typeof PAYLOADS)[T] => PAYLOADS[type];

const GROUPS = {
	run: RUN_PAYLOADS,
	trade: TRADE_PAYLOADS,
	machine: MACHINE_PAYLOADS,
	authority: AUTHORITY_PAYLOADS,
} as const;

export type EventGroup = keyof typeof GROUPS;

/** The event types in one group, for a reader that only handles one kind. */
export const eventTypesOf = <G extends EventGroup>(
	group: G,
): readonly (keyof (typeof GROUPS)[G])[] =>
	Object.keys(GROUPS[group]) as (keyof (typeof GROUPS)[G])[];

/** An event as it is written to the record, with its payload typed by its event type. */
export type RecordedEvent = {
	[T in EventType]: {
		machineId: string;
		type: T;
		payload: z.infer<(typeof PAYLOADS)[T]>;
	};
}[EventType];

const envelope = z.object({ machineId: id, type: z.enum(EVENT_TYPES) });

export type ParsedEvent =
	| { ok: true; value: RecordedEvent }
	| { ok: false; error: z.ZodError<unknown> };

/**
 * Checks an event before it is written. Nothing reaches the record without passing through here: the
 * envelope first, so an unknown type is refused before any payload is looked at, then the payload
 * against that type's own schema.
 */
export function parseEvent(event: unknown): ParsedEvent {
	const outer = envelope.safeParse(event);
	if (!outer.success) return { ok: false, error: outer.error };
	const payload = PAYLOADS[outer.data.type].safeParse((event as { payload: unknown }).payload);
	if (!payload.success) return { ok: false, error: payload.error };
	return {
		ok: true,
		value: {
			machineId: outer.data.machineId,
			type: outer.data.type,
			payload: payload.data,
		} as RecordedEvent,
	};
}
