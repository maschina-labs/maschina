import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { freeze, latestTraderRun, runningTraderRuns, saveTraderRun, thaw } from "./trader-runs.ts";

// Against a real database this is proved in packages/integration-tests.

const OWNER = "01a0e5db-f605-7209-8006-f225cc7c3215";
const fakeDatabase = (...answers: unknown[][]) =>
	({ execute: vi.fn(async () => answers.shift() ?? []) }) as unknown as Database;

describe("a trader run's state", () => {
	it("survives the trip through JSON exactly: huge amounts and times included", () => {
		const state = {
			cash: 40_000_000_000_000_000_000n,
			at: new Date("2026-10-03T12:00:00Z"),
			list: [1n, "x"],
			plain: { n: 3 },
		};
		expect(thaw(freeze(state))).toEqual(state);
	});

	it("leaves ordinary objects alone", () => {
		expect(thaw({ $big: "1", other: 2 })).toEqual({ $big: "1", other: 2 });
	});
});

describe("keeping runs", () => {
	it("saves one", async () => {
		const db = fakeDatabase();
		await saveTraderRun(db, { id: "r", ownerId: OWNER, status: "running", state: { cash: 1n } });
		expect(db.execute).toHaveBeenCalledOnce();
	});

	it("reads the newest back, thawed", async () => {
		const db = fakeDatabase([
			{
				id: "r",
				owner_id: OWNER,
				status: "running",
				state: { cash: { $big: "5" } },
				updated_at: "2026-10-03T12:00:00Z",
			},
		]);
		expect(await latestTraderRun(db, OWNER)).toEqual({
			id: "r",
			ownerId: OWNER,
			status: "running",
			state: { cash: 5n },
			updatedAt: new Date("2026-10-03T12:00:00Z"),
		});
		expect(await latestTraderRun(fakeDatabase([]), OWNER)).toBeUndefined();
	});

	it("lists the running ones", async () => {
		const db = fakeDatabase([
			{ id: "r", owner_id: OWNER, status: "running", state: {}, updated_at: new Date() },
		]);
		expect(await runningTraderRuns(db)).toHaveLength(1);
	});
});
