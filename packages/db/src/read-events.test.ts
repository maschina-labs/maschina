import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Executor } from "./client.ts";
import { readMachineEvents } from "./read-events.ts";

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
