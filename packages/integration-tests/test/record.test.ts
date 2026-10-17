/**
 * The permanent record. Everything a machine does is written here once and never changed, so these
 * tests prove the database itself refuses every way of rewriting history, for both roles.
 */

import { randomUUID } from "node:crypto";
import { newId } from "@maschina/core";
import {
	appendEvent,
	appendOwnerEvent,
	createDatabase,
	queueRun,
	saveDefinition,
} from "@maschina/db";
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

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
/** A different valid-looking Solana address each time, so tests never collide on the unique wallet. */
const base58Address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");

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

	/**
	 * A machine with a run somebody holds, because a lease is what permits a write and nothing else.
	 * Gives back what a node holding that run would present when it writes.
	 */
	async function aHeldRun(db: ReturnType<typeof createDatabase>["db"], sql: postgres.Sql) {
		const ownerId = newId<"owner">();
		await sql`
			insert into owners (id, wallet_address) values (${ownerId}::uuid, ${base58Address()})`;
		const saved = await saveDefinition(db, {
			kind: "recurring_buy",
			settings: { amount: randomUUID() },
			rules: {},
		});
		if (!saved.ok) throw saved.error;
		const machineId = newId<"machine">();
		await sql`
			insert into machines (id, owner_id, wallet_address, provider_wallet_id, provider,
				definition_id, name, paper)
			values (${machineId}::uuid, ${ownerId}::uuid, ${base58Address()}, ${"wallet-1"},
				${"turnkey"}, ${saved.value.id}, ${"Weekly SOL"}, false)`;
		const queued = await queueRun(db, {
			machineId,
			occurrenceKey: randomUUID(),
			dueAt: new Date(Date.now() - 60_000),
		});
		if (!queued.ok) throw queued.error;
		// Leased directly rather than through `claimDueRun`, which takes whichever run in the whole
		// database is due next and would happily hand back another test's. The helper's job is a
		// machine with a run it holds, not an exercise of the claiming rule.
		const [leased] = await sql<{ id: string; lease_epoch: string }[]>`
			update runs set state = 'leased', leased_by = ${newId<"node">()}::uuid,
				lease_expires_at = now() + interval '5 minutes', lease_epoch = lease_epoch + 1
			where id = ${queued.value.id}::uuid
			returning id, lease_epoch`;
		if (!leased) throw new Error("the run could not be leased");
		return {
			machineId,
			runId: leased.id,
			leaseEpoch: BigInt(leased.lease_epoch),
			started: {
				machineId,
				type: "run.started",
				payload: { runId: leased.id, nodeId: newId<"node">() },
				runId: leased.id,
			},
		};
	}

	it("writes a valid event and gives it a sortable v7 id", async () => {
		const { db, close } = handle();
		const sql = connect(database.appUrl);
		try {
			const held = await aHeldRun(db, sql);
			const written = await appendEvent(db, { ...held.started, leaseEpoch: held.leaseEpoch });

			expect(written.ok).toBe(true);
			if (!written.ok) return;
			expect(written.value.id[14], "version 7").toBe("7");
			expect(written.value.occurredAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
			const [row] = await sql<{ type: string; lease_epoch: string }[]>`
				select type, lease_epoch from events where id = ${written.value.id}`;
			expect(row).toEqual({ type: "run.started", lease_epoch: String(held.leaseEpoch) });
		} finally {
			await sql.end();
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
				runId: newId<"run">(),
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

	it("refuses a write under any epoch but the one the run is actually at", async () => {
		// The rule is not "newer than last time", it is "you hold this run, at this epoch". The old
		// rule compared the highest epoch any event for the machine had ever carried, which let a
		// node name a bigger number and outrank everybody, and refused a fresh run for counting from
		// one of its own.
		const { db, close } = handle();
		const sql = connect(database.appUrl);
		try {
			const held = await aHeldRun(db, sql);
			expect((await appendEvent(db, { ...held.started, leaseEpoch: held.leaseEpoch })).ok).toBe(
				true,
			);

			for (const wrong of [held.leaseEpoch - 1n, held.leaseEpoch + 1n, held.leaseEpoch + 500n]) {
				const refused = await appendEvent(db, { ...held.started, leaseEpoch: wrong });
				expect(refused.ok, `epoch ${wrong}`).toBe(false);
				if (!refused.ok) expect(refused.error.code).toBe("conflict");
			}

			// Holding it still works, as many times as the node needs.
			expect((await appendEvent(db, { ...held.started, leaseEpoch: held.leaseEpoch })).ok).toBe(
				true,
			);
			const [row] = await sql<{ count: string }[]>`
				select count(*) from events where machine_id = ${held.machineId}`;
			expect(row?.count).toBe("2");
		} finally {
			await sql.end();
			await close();
		}
	});

	it("refuses a write once the lease has run out, however recently it was held", async () => {
		const { db, close } = handle();
		const sql = connect(database.appUrl);
		try {
			const held = await aHeldRun(db, sql);
			await sql`
				update runs set lease_expires_at = now() - interval '1 second'
				where id = ${held.runId}::uuid`;

			const late = await appendEvent(db, { ...held.started, leaseEpoch: held.leaseEpoch });

			expect(late.ok).toBe(false);
		} finally {
			await sql.end();
			await close();
		}
	});

	it("lets an owner write with no lease at all, because an owner is not a node", async () => {
		// Starting, pausing or funding a machine belongs to nobody's run, and an owner is never stale.
		const { db, close } = handle();
		const sql = connect(database.appUrl);
		try {
			const held = await aHeldRun(db, sql);
			const written = await appendOwnerEvent(db, {
				machineId: held.machineId,
				type: "machine.started",
				payload: {},
			});

			expect(written.ok).toBe(true);
		} finally {
			await sql.end();
			await close();
		}
	});

	it("keeps one machine's runs from blocking another's", async () => {
		const { db, close } = handle();
		const sql = connect(database.appUrl);
		try {
			const busy = await aHeldRun(db, sql);
			const other = await aHeldRun(db, sql);

			expect((await appendEvent(db, { ...busy.started, leaseEpoch: busy.leaseEpoch })).ok).toBe(
				true,
			);
			expect((await appendEvent(db, { ...other.started, leaseEpoch: other.leaseEpoch })).ok).toBe(
				true,
			);
		} finally {
			await sql.end();
			await close();
		}
	});
});

describe("owners", () => {
	const OWNER = "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR";

	it("stores an owner by wallet address", async () => {
		const sql = connect(database.appUrl);
		try {
			const [row] = await sql<{ id: string; created_at: Date }[]>`
				insert into owners (id, wallet_address) values (${newId<"owner">()}::uuid, ${OWNER})
				returning id, created_at`;
			expect(row?.id).toBeDefined();
			expect(row?.created_at.getTime()).toBeGreaterThan(Date.now() - 60_000);
		} finally {
			await sql.end();
		}
	});

	it("keeps one owner per wallet address", async () => {
		const sql = connect(database.appUrl);
		const address = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
		try {
			await sql`insert into owners (id, wallet_address) values (${newId<"owner">()}::uuid, ${address})`;
			await expect(
				sql`insert into owners (id, wallet_address) values (${newId<"owner">()}::uuid, ${address})`,
			).rejects.toThrow(/duplicate key|unique/i);
		} finally {
			await sql.end();
		}
	});

	it("refuses an address that isn't a Solana address", async () => {
		const sql = connect(database.appUrl);
		try {
			for (const bad of [
				"",
				"not-an-address",
				"0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl",
				"8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR1234567890",
				"8GTgV1mscEjSoNmTdmNLaPjV1",
				" 8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR",
			]) {
				await expect(
					sql`insert into owners (id, wallet_address) values (${newId<"owner">()}::uuid, ${bad})`,
					bad,
				).rejects.toThrow(/owners_wallet_address_shape|violates check constraint/i);
			}
		} finally {
			await sql.end();
		}
	});
});

describe("machine definitions", () => {
	const recipe = {
		kind: "recurring_buy",
		settings: { amount: "25000000", mint: "So11111111111111111111111111111111111111112" },
		rules: { maxPerTrade: "50000000" },
	};

	it("saves a recipe once, however many times it is saved", async () => {
		const { db, close } = createDatabase({
			url: database.appUrl,
			applicationName: "definitions-test",
		});
		try {
			const first = await saveDefinition(db, recipe);
			const again = await saveDefinition(db, {
				rules: recipe.rules,
				settings: recipe.settings,
				kind: recipe.kind,
			});
			expect(first.ok && first.value.created).toBe(true);
			expect(again.ok && again.value.created).toBe(false);
			expect(first.ok && again.ok && first.value.id === again.value.id).toBe(true);

			const sql = connect(database.appUrl);
			try {
				const [row] = await sql<{ count: string }[]>`
					select count(*) from machine_definitions where id = ${first.ok ? first.value.id : ""}`;
				expect(row?.count).toBe("1");
			} finally {
				await sql.end();
			}
		} finally {
			await close();
		}
	});

	it("gives a changed recipe a new version, leaving the old one alone", async () => {
		const { db, close } = createDatabase({
			url: database.appUrl,
			applicationName: "definitions-test",
		});
		try {
			const before = await saveDefinition(db, { ...recipe, kind: "rebalance" });
			const after = await saveDefinition(db, {
				...recipe,
				kind: "rebalance",
				rules: { maxPerTrade: "1000" },
			});
			expect(before.ok && after.ok && before.value.id !== after.value.id).toBe(true);
			const sql = connect(database.appUrl);
			try {
				const rows = await sql<{ id: string }[]>`
					select id from machine_definitions where kind = ${"rebalance"}`;
				expect(rows).toHaveLength(2);
			} finally {
				await sql.end();
			}
		} finally {
			await close();
		}
	});

	for (const role of ["app", "owner"] as const) {
		it(`refuses to let the ${role} role change a saved version`, async () => {
			const url = role === "app" ? database.appUrl : database.ownerUrl;
			const { db, close } = createDatabase({
				url: database.appUrl,
				applicationName: "definitions-test",
			});
			const saved = await saveDefinition(db, { ...recipe, kind: `pinned_${role}` });
			await close();
			const sql = connect(url);
			try {
				const id = saved.ok ? saved.value.id : "";
				await expect(
					sql`update machine_definitions set kind = 'rewritten' where id = ${id}`,
				).rejects.toThrow(/permission denied|immutable/i);
				await expect(sql`delete from machine_definitions where id = ${id}`).rejects.toThrow(
					/permission denied|immutable/i,
				);
				// Once a machine points at a definition, Postgres refuses the truncate for that reason first.
				await expect(sql`truncate machine_definitions`).rejects.toThrow(
					/permission denied|immutable|cannot truncate a table referenced/i,
				);
			} finally {
				await sql.end();
			}
		});
	}
});

describe("machines", () => {
	const WALLET = "6Xa6BehnAkS9tUui8hYgNs9qjFmuxZe2pGZm9k8u2uvh";
	const OTHER_WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

	/** An owner and a definition to hang machines off, both fresh for each test. */
	async function ownerAndDefinition(sql: postgres.Sql) {
		const address = base58Address();
		const [owner] = await sql<{ id: string }[]>`
			insert into owners (id, wallet_address) values (${newId<"owner">()}::uuid, ${address})
			returning id`;
		const { db, close } = createDatabase({
			url: database.appUrl,
			applicationName: "machines-test",
		});
		const saved = await saveDefinition(db, {
			kind: "recurring_buy",
			settings: { amount: address.slice(0, 8) },
			rules: {},
		});
		await close();
		if (!owner || !saved.ok) throw new Error("could not set up the test");
		return { ownerId: owner.id, definitionId: saved.value.id };
	}

	const insertMachine = (
		sql: postgres.Sql,
		values: {
			ownerId: string;
			definitionId: string;
			wallet: string;
			provider?: string;
			name?: string;
		},
	) => sql`
		insert into machines (id, owner_id, wallet_address, provider_wallet_id, provider, definition_id,
			name, paper)
		values (${newId<"machine">()}, ${values.ownerId}, ${values.wallet}, ${"wallet-1"},
			${values.provider ?? "turnkey"}, ${values.definitionId}, ${values.name ?? "Weekly SOL"}, false)`;

	it("stores a machine with its owner, wallet and pinned definition", async () => {
		const sql = connect(database.appUrl);
		try {
			const { ownerId, definitionId } = await ownerAndDefinition(sql);
			await insertMachine(sql, { ownerId, definitionId, wallet: WALLET });
			const [row] = await sql<{ owner_id: string; definition_id: string; name: string }[]>`
				select owner_id, definition_id, name from machines where wallet_address = ${WALLET}`;
			expect(row).toEqual({ owner_id: ownerId, definition_id: definitionId, name: "Weekly SOL" });
		} finally {
			await sql.end();
		}
	});

	it("refuses to let two machines share a wallet", async () => {
		const sql = connect(database.appUrl);
		try {
			const first = await ownerAndDefinition(sql);
			const second = await ownerAndDefinition(sql);
			await insertMachine(sql, { ...first, wallet: OTHER_WALLET });
			await expect(insertMachine(sql, { ...second, wallet: OTHER_WALLET })).rejects.toThrow(
				/duplicate key|unique/i,
			);
		} finally {
			await sql.end();
		}
	});

	it("refuses a machine whose owner or definition doesn't exist", async () => {
		const sql = connect(database.appUrl);
		try {
			const { ownerId, definitionId } = await ownerAndDefinition(sql);
			await expect(
				insertMachine(sql, { ownerId: newId<"owner">(), definitionId, wallet: base58Address() }),
			).rejects.toThrow(/foreign key|violates/i);
			await expect(
				insertMachine(sql, { ownerId, definitionId: "f".repeat(64), wallet: base58Address() }),
			).rejects.toThrow(/foreign key|violates/i);
		} finally {
			await sql.end();
		}
	});

	it("refuses a bad wallet address, an unknown provider and an empty name", async () => {
		const sql = connect(database.appUrl);
		try {
			const base = await ownerAndDefinition(sql);
			await expect(insertMachine(sql, { ...base, wallet: "not-a-wallet" })).rejects.toThrow(
				/machines_wallet_address_shape/i,
			);
			await expect(
				insertMachine(sql, { ...base, wallet: base58Address(), provider: "someone_else" }),
			).rejects.toThrow(/machines_provider_known/i);
			await expect(
				insertMachine(sql, { ...base, wallet: base58Address(), name: "" }),
			).rejects.toThrow(/machines_name_length/i);
		} finally {
			await sql.end();
		}
	});

	it("keeps a machine's definition from being deleted under it", async () => {
		const sql = connect(database.ownerUrl);
		try {
			const appSql = connect(database.appUrl);
			const { ownerId, definitionId } = await ownerAndDefinition(appSql);
			await insertMachine(appSql, { ownerId, definitionId, wallet: base58Address() });
			await appSql.end();
			await expect(sql`delete from machine_definitions where id = ${definitionId}`).rejects.toThrow(
				/immutable|foreign key|permission denied/i,
			);
		} finally {
			await sql.end();
		}
	});
});
