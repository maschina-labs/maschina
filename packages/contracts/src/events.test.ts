import { describe, expect, it } from "vitest";
import { EVENT_TYPES, type EventType, eventPayload, eventTypesOf, parseEvent } from "./events.ts";

const MACHINE = "0199a0a0-0000-7000-8000-000000000001";
const RUN = "0199a0a0-0000-7000-8000-000000000002";
const NODE = "0199a0a0-0000-7000-8000-000000000003";
const OWNER = "0199a0a0-0000-7000-8000-000000000004";
const TRADE = "0199a0a0-0000-7000-8000-000000000005";
const VERSION = "b".repeat(64);
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WITHDRAWAL = "0199a0a0-0000-7000-8000-000000000006";
const OWNER_WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

/** One valid payload for every event type, so nothing can be added without an example. */
const payloads: Record<EventType, unknown> = {
	"run.queued": {
		runId: RUN,
		scheduledFor: "2026-09-17T12:00:00.000Z",
		occurrenceKey: "2026-09-17T12:00",
	},
	"run.started": { runId: RUN, nodeId: NODE },
	"run.skipped": { runId: RUN, reason: "machine_paused" },
	"run.finished": { runId: RUN, outcome: "completed", durationMs: 1200 },
	"trade.intended": {
		runId: RUN,
		tradeId: TRADE,
		inputMint: SOL,
		outputMint: USDC,
		inputAmount: "1000000",
		quotedOutputAmount: "24000000",
		slippageBps: 50,
	},
	"trade.simulated": {
		runId: RUN,
		tradeId: TRADE,
		inputMint: SOL,
		outputMint: USDC,
		inputAmount: "1000000",
		quotedOutputAmount: "24000000",
	},
	"trade.refused": {
		runId: RUN,
		tradeId: TRADE,
		by: "provider",
		rule: "recipients",
		reason: "not approved",
	},
	"trade.submitted": {
		runId: RUN,
		tradeId: TRADE,
		signature: "5".repeat(88),
		lastValidBlockHeight: "426070577",
	},
	"trade.completed": {
		runId: RUN,
		tradeId: TRADE,
		signature: "5".repeat(88),
		inputAmount: "1000000",
		outputAmount: "23950000",
		feeLamports: "5000",
	},
	"trade.failed": { runId: RUN, tradeId: TRADE, stage: "confirm", reason: "blockhash expired" },
	"machine.created": { ownerId: OWNER, definitionVersionId: VERSION, walletAddress: SOL },
	"machine.started": {},
	"machine.paused": { reason: "repeated_failures", detail: "three runs failed the same way" },
	"machine.resumed": {},
	"machine.stopped": { by: "owner" },
	"machine.limits_changed": { limit: "maxPerTrade", from: "1000000", to: "2000000" },
	"authority.used": { action: "sign_transaction", runId: RUN, amount: "1000000" },
	"authority.denied": { action: "sign_transaction", rule: "budget", reason: "budget exhausted" },
	"withdrawal.requested": { withdrawalId: WITHDRAWAL, to: OWNER_WALLET, lamports: "250000000" },
	"withdrawal.completed": {
		withdrawalId: WITHDRAWAL,
		to: OWNER_WALLET,
		lamports: "250000000",
		signature: "5".repeat(88),
		feeLamports: "5000",
		slot: "426070577",
	},
	"withdrawal.failed": { withdrawalId: WITHDRAWAL, reason: "the transaction expired" },
};

describe("EVENT_TYPES", () => {
	it("covers runs, trades, machines, withdrawals and authority", () => {
		expect([...EVENT_TYPES].sort()).toEqual([
			"authority.denied",
			"authority.used",
			"machine.created",
			"machine.limits_changed",
			"machine.paused",
			"machine.resumed",
			"machine.started",
			"machine.stopped",
			"run.finished",
			"run.queued",
			"run.skipped",
			"run.started",
			"trade.completed",
			"trade.failed",
			"trade.intended",
			"trade.refused",
			"trade.simulated",
			"trade.submitted",
			"withdrawal.completed",
			"withdrawal.failed",
			"withdrawal.requested",
		]);
	});

	it("has a schema and an example for every type", () => {
		for (const type of EVENT_TYPES) {
			expect(eventPayload(type), type).toBeDefined();
			expect(Object.keys(payloads)).toContain(type);
		}
	});
});

describe("parseEvent", () => {
	it("accepts a valid event of every type", () => {
		for (const type of EVENT_TYPES) {
			const event = { machineId: MACHINE, type, payload: payloads[type] };
			expect(parseEvent(event).ok, type).toBe(true);
		}
	});

	it("refuses an event type nobody defined", () => {
		const result = parseEvent({ machineId: MACHINE, type: "trade.sneaky", payload: {} });
		expect(result.ok).toBe(false);
	});

	it("refuses a payload missing a required field", () => {
		expect(parseEvent({ machineId: MACHINE, type: "run.started", payload: {} }).ok).toBe(false);
	});

	it("refuses a reason nobody defined", () => {
		const event = {
			machineId: MACHINE,
			type: "run.skipped",
			payload: { runId: RUN, reason: "felt like it" },
		};
		expect(parseEvent(event).ok).toBe(false);
	});

	it("refuses extra fields, so a typo can't be recorded and silently ignored", () => {
		const event = {
			machineId: MACHINE,
			type: "run.started",
			payload: { runId: RUN, nodeId: NODE, ndoeId: NODE },
		};
		expect(parseEvent(event).ok).toBe(false);
	});

	it("refuses an amount that isn't whole base units", () => {
		for (const amount of ["1.5", "-1", "1e6", "", "0x10"]) {
			const payload = { ...(payloads["authority.used"] as object), amount };
			expect(parseEvent({ machineId: MACHINE, type: "authority.used", payload }).ok, amount).toBe(
				false,
			);
		}
	});

	it("refuses an id that isn't a v7 uuid", () => {
		const event = { machineId: "not-an-id", type: "machine.started", payload: {} };
		expect(parseEvent(event).ok).toBe(false);
	});

	it("returns the parsed event, so callers use the checked value", () => {
		const result = parseEvent({
			machineId: MACHINE,
			type: "run.finished",
			payload: payloads["run.finished"],
		});
		expect(result.ok && result.value.type).toBe("run.finished");
		expect(result.ok && result.value.payload).toEqual(payloads["run.finished"]);
	});
});

describe("the event schemas", () => {
	it("can be used one at a time, for a reader that only cares about one kind", () => {
		const parsed = eventPayload("machine.created").safeParse(payloads["machine.created"]);
		expect(parsed.success).toBe(true);
		expect(eventPayload("machine.created").safeParse({ ownerId: OWNER }).success).toBe(false);
	});

	it("groups the types, so a reader can take only runs or only trades", () => {
		expect(eventTypesOf("run")).toEqual([
			"run.queued",
			"run.started",
			"run.skipped",
			"run.finished",
		]);
		expect(eventTypesOf("authority")).toEqual(["authority.used", "authority.denied"]);
		// A withdrawal is not a trade: an owner taking their money back is not the machine doing its job.
		expect(eventTypesOf("withdrawal")).toEqual([
			"withdrawal.requested",
			"withdrawal.completed",
			"withdrawal.failed",
		]);
		const grouped = (["run", "trade", "machine", "withdrawal", "authority"] as const).flatMap((g) =>
			eventTypesOf(g),
		);
		expect([...grouped].sort()).toEqual([...EVENT_TYPES].sort());
	});
});
