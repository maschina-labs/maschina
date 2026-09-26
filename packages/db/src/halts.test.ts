import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { engageHalt, haltInForce, releaseHalt, stopEveryMachine } from "./halts.ts";

function fakeDatabase(...answers: unknown[][]) {
	const statements: string[] = [];
	const execute = vi.fn(async (query: { queryChunks?: unknown[] }) => {
		statements.push(JSON.stringify(query.queryChunks ?? query));
		return answers.shift() ?? [];
	});
	const database = {
		execute,
		transaction: async (run: (tx: unknown) => unknown) => run({ execute }),
	} as unknown as Database;
	return { database, statements };
}

describe("the kill switch", () => {
	it("is not in force when nothing has been engaged", async () => {
		const { database } = fakeDatabase([]);

		expect(await haltInForce(database)).toBeUndefined();
	});

	it("says why and who, while it is in force", async () => {
		const { database } = fakeDatabase([
			{
				id: "01a0df00-0000-7000-8000-000000000001",
				reason: "the price feed is lying",
				engaged_by: "ash",
				engaged_at: "2026-09-26T09:00:00.000Z",
			},
		]);

		expect(await haltInForce(database)).toMatchObject({
			reason: "the price feed is lying",
			engagedBy: "ash",
		});
	});

	it("only counts a halt nobody has released", async () => {
		const { database, statements } = fakeDatabase([]);

		await haltInForce(database);

		expect(statements[0]).toContain("released_at is null");
	});

	it("engages with a reason and a name, and refuses an empty reason", async () => {
		const { database } = fakeDatabase([{ id: "01a0df00-0000-7000-8000-000000000001" }]);

		const engaged = await engageHalt(database, { reason: "something is wrong", engagedBy: "ash" });

		expect(engaged.ok).toBe(true);
		const empty = await engageHalt(database, { reason: "   ", engagedBy: "ash" });
		expect(empty.ok).toBe(false);
	});

	it("releases only what is in force, and says who released it", async () => {
		const { database, statements } = fakeDatabase([{ id: "01a0df00-0000-7000-8000-000000000001" }]);

		const released = await releaseHalt(database, { releasedBy: "ash" });

		expect(released.ok).toBe(true);
		expect(statements[0]).toContain("released_at is null");
	});

	it("says so when there was nothing to release, rather than pretending", async () => {
		const { database } = fakeDatabase([]);

		const released = await releaseHalt(database, { releasedBy: "ash" });

		expect(released.ok).toBe(false);
	});
});

describe("stopping every machine", () => {
	it("stops each one that is not stopped already, and says how many", async () => {
		const { database } = fakeDatabase(
			[
				{ id: "01a0de78-31e2-7909-8328-7ad43fc8cc2d" },
				{ id: "01a0dc24-9e5d-7061-9a53-b8b38753d78a" },
			],
			[{ id: "01a0df00-0000-7000-8000-000000000002", occurred_at: "2026-09-26T09:00:00.000Z" }],
			[{ id: "01a0df00-0000-7000-8000-000000000003", occurred_at: "2026-09-26T09:00:00.000Z" }],
		);

		const stopped = await stopEveryMachine(database, { reason: "kill switch", by: "ash" });

		expect(stopped).toMatchObject({ ok: true, value: { stopped: 2 } });
	});

	it("stops nothing when every machine is already stopped", async () => {
		const { database } = fakeDatabase([]);

		expect(await stopEveryMachine(database, { reason: "kill switch", by: "ash" })).toMatchObject({
			ok: true,
			value: { stopped: 0 },
		});
	});
});
