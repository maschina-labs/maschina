import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { appendEvent } from "./record.ts";

const machineId = newId<"machine">();
const runId = newId<"run">();
const nodeId = newId<"node">();

/** A database that records what it was asked to run and answers with one row. */
function fakeDatabase(rows: unknown[] = [{ id: newId<"event">(), occurred_at: new Date() }]) {
	const execute = vi.fn(async () => rows);
	return { db: { execute } as unknown as Database, execute };
}

const valid = {
	machineId,
	type: "run.started",
	payload: { runId, nodeId },
	leaseEpoch: 3n,
};

describe("appendEvent", () => {
	it("writes an event that matches its type, and returns its id and time", async () => {
		const { db, execute } = fakeDatabase();
		const result = await appendEvent(db, valid);
		expect(result.ok).toBe(true);
		expect(execute).toHaveBeenCalledOnce();
	});

	it("refuses a payload that doesn't match its type, without touching the database", async () => {
		const { db, execute } = fakeDatabase();
		const result = await appendEvent(db, { ...valid, payload: { runId } });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("invalid_input");
		expect(execute).not.toHaveBeenCalled();
	});

	it("refuses an event type nobody defined, without touching the database", async () => {
		const { db, execute } = fakeDatabase();
		const result = await appendEvent(db, { ...valid, type: "run.invented" });
		expect(result.ok && false).toBe(false);
		expect(execute).not.toHaveBeenCalled();
	});

	it("refuses a negative lease epoch", async () => {
		const { db, execute } = fakeDatabase();
		const result = await appendEvent(db, { ...valid, leaseEpoch: -1n });
		expect(result.ok).toBe(false);
		expect(execute).not.toHaveBeenCalled();
	});

	it("reports a write that a newer lease blocked as a conflict", async () => {
		const { db } = fakeDatabase([]);
		const result = await appendEvent(db, valid);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("conflict");
			expect(result.error.message).toMatch(/newer lease/);
		}
	});
});
