/**
 * The permanent record. Everything a machine does is written here once and never changed, so these
 * tests prove the database itself refuses every way of rewriting history, for both roles.
 */

import { randomUUID } from "node:crypto";
import { newId } from "@maschina/core";
import { appendEvent, createDatabase } from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
});

afterAll(async () => {
	await database?.drop();
});

const connect = (url: string) => postgres(url, { max: 1, onnotice: () => {} });

async function insertEvent(sql: postgres.Sql, machineId = randomUUID()) {
	const [row] = await sql<{ id: string }[]>`
		insert into events (machine_id, type, payload, lease_epoch)
		values (${machineId}, 'machine.created', ${sql.json({ reason: "test" })}, 1)
		returning id`;
	if (!row) throw new Error("the insert returned nothing");
	return row.id;
}

describe("the record", () => {
	it("lets the app role append an event and read it back", async () => {
		const sql = connect(database.appUrl);
		try {
			const machineId = randomUUID();
			const id = await insertEvent(sql, machineId);
			const [row] = await sql<
				{
					machine_id: string;
					type: string;
					payload: { reason: string };
					lease_epoch: string;
					occurred_at: Date;
				}[]
			>`select machine_id, type, payload, lease_epoch, occurred_at from events where id = ${id}`;
			expect(row?.machine_id).toBe(machineId);
			expect(row?.type).toBe("machine.created");
			expect(row?.payload).toEqual({ reason: "test" });
			expect(row?.lease_epoch).toBe("1");
			expect(row?.occurred_at.getTime()).toBeGreaterThan(Date.now() - 60_000);
		} finally {
			await sql.end();
		}
	});

	it("gives every event its own id without being told one", async () => {
		const sql = connect(database.appUrl);
		try {
			const first = await insertEvent(sql);
			const second = await insertEvent(sql);
			expect(first).not.toBe(second);
		} finally {
			await sql.end();
		}
	});

	for (const role of ["app", "owner"] as const) {
		describe(`the ${role} role`, () => {
			const url = () => (role === "app" ? database.appUrl : database.ownerUrl);

			it("can never update an event", async () => {
				const sql = connect(url());
				try {
					const id = await insertEvent(connect(database.appUrl));
					await expect(sql`update events set type = 'rewritten' where id = ${id}`).rejects.toThrow(
						/permission denied|append only/i,
					);
					const [row] = await sql<{ type: string }[]>`select type from events where id = ${id}`;
					expect(row?.type).toBe("machine.created");
				} finally {
					await sql.end();
				}
			});

			it("can never delete an event", async () => {
				const sql = connect(url());
				try {
					const id = await insertEvent(connect(database.appUrl));
					await expect(sql`delete from events where id = ${id}`).rejects.toThrow(
						/permission denied|append only/i,
					);
					const [row] = await sql<
						{ count: string }[]
					>`select count(*) from events where id = ${id}`;
					expect(row?.count).toBe("1");
				} finally {
					await sql.end();
				}
			});

			it("can never truncate the record", async () => {
				const sql = connect(url());
				try {
					await insertEvent(connect(database.appUrl));
					await expect(sql`truncate events`).rejects.toThrow(/permission denied|append only/i);
					const [row] = await sql<{ count: string }[]>`select count(*) from events`;
					expect(Number(row?.count)).toBeGreaterThan(0);
				} finally {
					await sql.end();
				}
			});
		});
	}

	it("refuses an event type the contracts don't define", async () => {
		const sql = connect(database.appUrl);
		try {
			await expect(
				sql`insert into events (machine_id, type, lease_epoch) values (${randomUUID()}, 'trade.sneaky', 1)`,
			).rejects.toThrow(/events_type_known|violates check constraint/i);
			await expect(
				sql`insert into events (machine_id, type, lease_epoch) values (${randomUUID()}, 'machine.created', 1)`,
			).resolves.toBeDefined();
		} finally {
			await sql.end();
		}
	});

	it("refuses an event with no machine, no type or no lease epoch", async () => {
		const sql = connect(database.appUrl);
		try {
			for (const bad of [
				sql`insert into events (type, lease_epoch) values ('machine.created', 1)`,
				sql`insert into events (machine_id, lease_epoch) values (${randomUUID()}, 1)`,
				sql`insert into events (machine_id, type) values (${randomUUID()}, 'machine.created')`,
			]) {
				await expect(bad).rejects.toThrow(/null value|not-null/i);
			}
		} finally {
			await sql.end();
		}
	});
});

describe("appendEvent", () => {
	const handle = () =>
		createDatabase({ url: database.appUrl, applicationName: "record-writer-test" });

	it("writes a valid event and gives it a sortable v7 id", async () => {
		const { db, close } = handle();
		try {
			const machineId = newId<"machine">();
			const written = await appendEvent(db, {
				machineId,
				type: "machine.started",
				payload: {},
				leaseEpoch: 1n,
			});
			expect(written.ok).toBe(true);
			if (!written.ok) return;
			expect(written.value.id[14], "version 7").toBe("7");
			expect(written.value.occurredAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
			const sql = connect(database.appUrl);
			try {
				const [row] = await sql<{ type: string; lease_epoch: string }[]>`
					select type, lease_epoch from events where id = ${written.value.id}`;
				expect(row).toEqual({ type: "machine.started", lease_epoch: "1" });
			} finally {
				await sql.end();
			}
		} finally {
			await close();
		}
	});

	it("refuses a payload that doesn't match its type, and writes nothing", async () => {
		const { db, close } = handle();
		try {
			const machineId = newId<"machine">();
			const result = await appendEvent(db, {
				machineId,
				type: "run.started",
				payload: { runId: newId<"machine">() },
				leaseEpoch: 1n,
			});
			expect(result.ok).toBe(false);
			const sql = connect(database.appUrl);
			try {
				const [row] = await sql<{ count: string }[]>`
					select count(*) from events where machine_id = ${machineId}`;
				expect(row?.count).toBe("0");
			} finally {
				await sql.end();
			}
		} finally {
			await close();
		}
	});

	it("refuses a write from a lease the machine has moved on from", async () => {
		const { db, close } = handle();
		try {
			const machineId = newId<"machine">();
			const event = { machineId, type: "machine.started", payload: {} };
			expect((await appendEvent(db, { ...event, leaseEpoch: 5n })).ok).toBe(true);

			const stale = await appendEvent(db, { ...event, leaseEpoch: 4n });
			expect(stale.ok).toBe(false);
			if (!stale.ok) expect(stale.error.code).toBe("conflict");

			// The current lease and a newer one both still work.
			expect((await appendEvent(db, { ...event, leaseEpoch: 5n })).ok).toBe(true);
			expect((await appendEvent(db, { ...event, leaseEpoch: 6n })).ok).toBe(true);

			const sql = connect(database.appUrl);
			try {
				const [row] = await sql<{ count: string }[]>`
					select count(*) from events where machine_id = ${machineId}`;
				expect(row?.count).toBe("3");
			} finally {
				await sql.end();
			}
		} finally {
			await close();
		}
	});

	it("keeps one machine's leases from blocking another's", async () => {
		const { db, close } = handle();
		try {
			const busy = newId<"machine">();
			await appendEvent(db, {
				machineId: busy,
				type: "machine.started",
				payload: {},
				leaseEpoch: 9n,
			});
			const other = await appendEvent(db, {
				machineId: newId<"machine">(),
				type: "machine.started",
				payload: {},
				leaseEpoch: 1n,
			});
			expect(other.ok).toBe(true);
		} finally {
			await close();
		}
	});
});
