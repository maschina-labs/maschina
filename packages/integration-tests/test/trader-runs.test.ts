/** Trader runs, against real Postgres: saved, replaced, read back exactly. */

import { newId } from "@maschina/core";
import {
	createDatabase,
	createOwner,
	type DatabaseHandle,
	latestTraderRun,
	runningTraderRuns,
	saveTraderRun,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "trader-runs-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");

describe("trader runs", () => {
	it("keeps a run's state exactly, replaces it on save, and lists it while running", async () => {
		const made = await createOwner(handle.db, address());
		if (!made.ok) throw made.error;
		const id = newId<"run">();
		const at = new Date("2026-10-03T12:00:00Z");
		await saveTraderRun(handle.db, {
			id,
			ownerId: made.value.id,
			status: "running",
			state: { cash: 40_000_000n, at },
		});
		await saveTraderRun(handle.db, {
			id,
			ownerId: made.value.id,
			status: "running",
			state: { cash: 39_000_000n, at },
		});
		expect((await latestTraderRun(handle.db, made.value.id))?.state).toEqual({
			cash: 39_000_000n,
			at,
		});
		expect((await runningTraderRuns(handle.db)).some((run) => run.id === id)).toBe(true);
		await saveTraderRun(handle.db, { id, ownerId: made.value.id, status: "stopped", state: {} });
		expect((await runningTraderRuns(handle.db)).some((run) => run.id === id)).toBe(false);
	});
});
