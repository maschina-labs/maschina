import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Executor } from "./client.ts";
import { readMachineEvents, readOwnerPublicEvents } from "./read-events.ts";

const machineId = newId<"machine">();

const row = (over: Record<string, unknown> = {}) => ({
	id: newId<"event">(),
	machine_id: machineId,
	type: "machine.started",
	payload: {},
	occurred_at: "2026-09-18T12:00:00.000Z",
	...over,
});

const fakeDatabase = (rows: unknown[]) => {
	const execute = vi.fn(async () => rows);
	return { db: { execute } as unknown as Executor, execute };
};

describe("reading a machine's record", () => {
	it("returns events with their moment as a date", async () => {
		const { db } = fakeDatabase([row()]);

		const events = await readMachineEvents(db, machineId);

		expect(events).toHaveLength(1);
		expect(events[0]?.occurredAt).toBeInstanceOf(Date);
		expect(events[0]?.machineId).toBe(machineId);
		expect(events[0]?.type).toBe("machine.started");
	});

	it("accepts a moment the driver already turned into a date", async () => {
		const when = new Date("2026-09-18T12:00:00.000Z");
		const { db } = fakeDatabase([row({ occurred_at: when })]);

		const events = await readMachineEvents(db, machineId);

		expect(events[0]?.occurredAt.getTime()).toBe(when.getTime());
	});

	it("is empty for a machine with no record", async () => {
		const { db } = fakeDatabase([]);

		expect(await readMachineEvents(db, machineId)).toEqual([]);
	});

	it("asks only for events since a moment when given one", async () => {
		const { db, execute } = fakeDatabase([]);

		await readMachineEvents(db, machineId, { since: new Date("2026-09-18T00:00:00.000Z") });

		expect(JSON.stringify(execute.mock.calls)).toContain("2026-09-18T00:00:00.000Z");
	});
});

describe("reading an owner's public record", () => {
	const ownerId = newId<"owner">();
	const trade = (tradeId: string, type: string, at: string) =>
		row({ type, payload: { tradeId }, occurred_at: at });

	/** A database that answers each call in turn: first the finished trades, then their intents. */
	const inTurn = (answers: unknown[][]) => {
		const calls: string[] = [];
		const execute = vi.fn(async (query: unknown) => {
			calls.push(JSON.stringify(query));
			return answers[calls.length - 1] ?? [];
		});
		return { db: { execute } as unknown as Executor, execute, calls };
	};

	it("asks for finished trades across every machine the owner has, newest first", async () => {
		const { db, calls } = inTurn([[], []]);

		await readOwnerPublicEvents(db, ownerId, 50);

		const asked = calls[0] ?? "";
		expect(asked).toContain("owner_id");
		expect(asked).toContain("trade.completed");
		expect(asked).toContain("trade.simulated");
		expect(asked).toContain("desc");
	});

	it("limits in the query, so a long history is never read to show a few trades", async () => {
		// F-17: this is the one route anybody may ask for as often as they like.
		const { db, calls } = inTurn([[], []]);

		await readOwnerPublicEvents(db, ownerId, 50);

		expect(calls[0]).toContain("limit");
	});

	it("fetches the intents for those trades, and nothing else", async () => {
		const { db, calls } = inTurn([
			[trade("t1", "trade.completed", "2026-10-01T12:00:00.000Z")],
			[trade("t1", "trade.intended", "2026-10-01T11:59:00.000Z")],
		]);

		await readOwnerPublicEvents(db, ownerId, 50);

		expect(calls).toHaveLength(2);
		expect(calls[1]).toContain("trade.intended");
		expect(calls[1]).toContain("t1");
	});

	it("does not ask a second time when there are no trades to ask about", async () => {
		const { db, calls } = inTurn([[]]);

		expect(await readOwnerPublicEvents(db, ownerId, 50)).toEqual([]);
		expect(calls).toHaveLength(1);
	});

	it("gives them back oldest first, so an intent arrives before its completion", async () => {
		// The projection reads in order: a completion whose intent has not been seen has no side.
		const { db } = inTurn([
			[trade("t1", "trade.completed", "2026-10-01T12:00:04.000Z")],
			[trade("t1", "trade.intended", "2026-10-01T12:00:00.000Z")],
		]);

		const events = await readOwnerPublicEvents(db, ownerId, 50);

		expect(events.map((event) => event.type)).toEqual(["trade.intended", "trade.completed"]);
	});

	it("skips a row whose payload names no trade, rather than asking about undefined", async () => {
		const { db, calls } = inTurn([[row({ type: "trade.completed", payload: {} })], []]);

		await readOwnerPublicEvents(db, ownerId, 50);

		// Nothing to pair, so no second query at all.
		expect(calls).toHaveLength(1);
	});

	it("gives every event its moment as a date", async () => {
		const { db } = inTurn([[trade("t1", "trade.simulated", "2026-10-01T12:00:00.000Z")], []]);

		const [event] = await readOwnerPublicEvents(db, ownerId, 50);

		expect(event?.occurredAt).toBeInstanceOf(Date);
		expect(event?.occurredAt.toISOString()).toBe("2026-10-01T12:00:00.000Z");
	});
});
