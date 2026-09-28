import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import { markDelivered, pendingAlerts } from "./alerts.ts";
import type { Database } from "./client.ts";

// Against a real database this is proved in packages/integration-tests.

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const ownerId = newId<"owner">();
const machineId = newId<"machine">();
const range = {
	kind: "range",
	settings: {
		quoteMint: USDC,
		baseMint: SOL,
		buyLevel: "118800000",
		sellLevel: "121200000",
		amountPerBuy: "40350000",
	},
};

const row = (type: string, payload: object, over: object = {}) => ({
	id: newId<"event">(),
	machine_id: machineId,
	type,
	payload,
	occurred_at: "2026-09-29T02:00:00.000Z",
	owner_id: ownerId,
	name: "Range Finder",
	...range,
	...over,
});

function fakeDatabase(...answers: unknown[][]) {
	const execute = vi.fn(async () => answers.shift() ?? []);
	return { db: { execute } as unknown as Database, execute };
}

const ask = { channel: "telegram" as const, ownerIds: [ownerId], since: new Date(0) };

describe("pendingAlerts", () => {
	it("asks nothing when there is nobody to tell", async () => {
		const { db, execute } = fakeDatabase();
		expect(await pendingAlerts(db, { ...ask, ownerIds: [] })).toEqual([]);
		expect(execute).not.toHaveBeenCalled();
	});

	it("leaves out what the owner did themselves, and keeps why a machine stopped itself", async () => {
		const { db } = fakeDatabase([
			row("machine.paused", { reason: "owner" }),
			row("machine.stopped", { by: "owner" }),
			row("machine.stopped", { by: "system", reason: "budget spent" }),
			row("trade.failed", { reason: "" }),
		]);
		const alerts = await pendingAlerts(db, ask);
		expect(alerts.map((alert) => [alert.type, alert.reason])).toEqual([
			["machine.stopped", "budget spent"],
			["trade.failed", undefined],
		]);
		expect(alerts[0]?.occurredAt).toEqual(new Date("2026-09-29T02:00:00.000Z"));
	});

	it("reads which way a trade went and what the machine has realised", async () => {
		const tradeId = newId<"trade">();
		const completed = row(
			"trade.completed",
			{
				runId: newId<"run">(),
				tradeId,
				signature: "5".repeat(88),
				inputAmount: "40350000",
				outputAmount: "339698787",
				feeLamports: "5000",
			},
			{ occurred_at: new Date("2026-09-29T02:00:00.000Z") },
		);
		const record = [
			{
				id: newId<"event">(),
				machine_id: machineId,
				type: "trade.intended",
				payload: {
					runId: newId<"run">(),
					tradeId,
					inputMint: USDC,
					outputMint: SOL,
					inputAmount: "40350000",
					quotedOutputAmount: "339000000",
					slippageBps: 50,
				},
				occurred_at: "2026-09-29T01:59:59.000Z",
			},
			{ ...completed, occurred_at: "2026-09-29T02:00:00.000Z" },
		];
		const { db } = fakeDatabase([completed], record);
		const [alert] = await pendingAlerts(db, ask);
		expect(alert?.trade).toEqual({
			inputMint: USDC,
			outputMint: SOL,
			inputAmount: 40_350_000n,
			outputAmount: 339_698_787n,
		});
		expect(alert?.realised).toBe(0n);
	});

	it("says no direction or result when the record cannot give one", async () => {
		const completed = row(
			"trade.completed",
			{ tradeId: "t", inputAmount: "1", outputAmount: "1" },
			{ kind: "unknown_kind", settings: {} },
		);
		const { db } = fakeDatabase([completed], []);
		const [alert] = await pendingAlerts(db, ask);
		expect(alert?.trade).toBeUndefined();
		expect(alert?.realised).toBeUndefined();
	});
});

describe("markDelivered", () => {
	it("writes the delivery once, whatever happens twice", async () => {
		const { db, execute } = fakeDatabase();
		await markDelivered(db, { eventId: newId<"event">(), channel: "telegram" });
		expect(JSON.stringify(execute.mock.calls)).toContain("on conflict do nothing");
	});
});
