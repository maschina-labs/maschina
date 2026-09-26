import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { runContext } from "./run-context.ts";

// Against a real database this is proved in packages/integration-tests. These cover reading the rows.

const machineId = newId<"machine">();
const lease = { runId: newId<"run">(), nodeId: newId<"node">(), leaseEpoch: 2n, now: new Date() };

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { execute } as unknown as Database;
}

const row = {
	machine_id: machineId,
	wallet_address: "WaLLet1111111111111111111111111111111111111",
	kind: "recurring_buy",
	settings: { amountPerBuy: "5" },
	due_at: "2026-09-21T09:00:00.000Z",
};

const event = (type: string, payload: object) => ({
	id: newId<"event">(),
	machine_id: machineId,
	type,
	payload,
	occurred_at: "2026-09-21T09:00:00.000Z",
});

describe("runContext", () => {
	it("tells a node nothing when it does not hold the run", async () => {
		expect(await runContext(fakeDatabase([]), lease)).toBeUndefined();
	});

	it("counts completed trades as what the machine has spent", async () => {
		const tradeId = newId<"trade">();
		const events = [
			event("machine.limits_changed", { limit: "budgetGranted", from: null, to: "1000" }),
			event("trade.completed", {
				runId: lease.runId,
				tradeId,
				signature: "5".repeat(88),
				inputAmount: "300",
				outputAmount: "1",
				feeLamports: "5",
			}),
		];
		const context = await runContext(fakeDatabase([row], events), lease);

		expect(context?.totals).toEqual({ spent: 300n, buys: 1 });
		expect(context?.canAct).toBe(false);
		expect(context?.dueAt).toEqual(new Date("2026-09-21T09:00:00.000Z"));
	});

	it("accepts a due time the driver already turned into a date", async () => {
		const due = new Date("2026-09-21T09:00:00.000Z");
		const context = await runContext(fakeDatabase([{ ...row, due_at: due }], []), lease);
		expect(context?.dueAt).toEqual(due);
	});
});

describe("the level that woke a machine", () => {
	it("is passed on, so a machine with two levels knows which one fired", async () => {
		const db = fakeDatabase([{ ...row, kind: "price_trigger", woke_on: "low" }], []);

		expect(await runContext(db, lease)).toMatchObject({ wokeOn: "low" });
	});

	it("is absent for a run that came from a schedule rather than a price", async () => {
		const db = fakeDatabase([{ ...row, woke_on: null }], []);
		const context = await runContext(db, lease);

		// Absent, not empty: a scheduled run was not woken by any level, and saying "" would be a lie.
		expect(context && "wokeOn" in context).toBe(false);
	});
});
