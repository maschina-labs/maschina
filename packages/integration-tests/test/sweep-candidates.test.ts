/**
 * Which machines the orchestrator asks the signer about, against real Postgres.
 *
 * Not whether anything is due: only the signer can say that, because only it reads the chain. This is
 * the list worth asking about, and each exclusion is there to stop a sweep that must not happen.
 */

import { newId } from "@maschina/core";
import {
	appendEvent,
	createDatabase,
	type DatabaseHandle,
	saveDefinition,
	sweepCandidates,
} from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "sweep-candidates-test" });
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const address = () =>
	Array.from({ length: 43 }, () => BASE58[Math.floor(Math.random() * BASE58.length)]).join("");
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const append = async (machineId: string, type: string, payload: object) => {
	const written = await appendEvent(handle.db, {
		machineId,
		leaseEpoch: 0n,
		type,
		payload,
	} as never);
	if (!written.ok) throw written.error;
};

/** A range machine, with or without a vault, on paper or not, in a state. */
async function aMachine(options: {
	vault?: boolean;
	paper?: boolean;
	state?: "running" | "paused" | "stopped";
}) {
	const { vault = true, paper = false, state = "running" } = options;
	const sql = handle.sql;
	const ownerId = newId<"owner">();
	const wallet = address();
	await sql`insert into owners (id, wallet_address) values (${ownerId}::uuid, ${address()})`;
	const saved = await saveDefinition(handle.db, {
		kind: "range",
		settings: {
			quoteMint: USDC,
			baseMint: SOL,
			buyLevel: "140000000",
			sellLevel: "150000000",
			amountPerBuy: "15000000",
		},
		rules: {},
	});
	if (!saved.ok) throw new Error("could not save the definition");
	const machineId = newId<"machine">();
	await sql`
		insert into machines (id, owner_id, wallet_address, vault_address, provider_wallet_id, provider,
			definition_id, name, paper)
		values (${machineId}::uuid, ${ownerId}::uuid, ${wallet}, ${vault ? address() : null},
			${"wallet-1"}, ${"turnkey"}, ${saved.value.id}, ${"A machine"}, ${paper})`;

	await append(machineId, "machine.created", {
		ownerId,
		definitionVersionId: "a".repeat(64),
		walletAddress: wallet,
	});
	await append(machineId, "machine.limits_changed", {
		limit: "budgetGranted",
		from: null,
		to: "50000000",
	});
	await append(machineId, "machine.started", {});
	if (state === "paused") await append(machineId, "machine.paused", { reason: "owner" });
	if (state === "stopped") await append(machineId, "machine.stopped", { by: "owner" });
	return machineId;
}

const listed = async () => (await sweepCandidates(handle.db)).map((c) => c.machineId);

describe("the machines worth asking about a sweep", () => {
	it("include a running machine with a vault", async () => {
		const machineId = await aMachine({});
		expect(await listed()).toContain(machineId);
	});

	it("include a paused one, because pausing stops trading and not banking", async () => {
		const machineId = await aMachine({ state: "paused" });
		expect(await listed()).toContain(machineId);
	});

	it("leave out a machine made before vaults, which has nowhere to bank", async () => {
		const machineId = await aMachine({ vault: false });
		expect(await listed()).not.toContain(machineId);
	});

	it("leave out a machine on paper, whose profit is not money", async () => {
		const machineId = await aMachine({ paper: true });
		expect(await listed()).not.toContain(machineId);
	});

	it("leave out a stopped machine, whose owner is taking their money rather than earning it", async () => {
		const machineId = await aMachine({ state: "stopped" });
		expect(await listed()).not.toContain(machineId);
	});

	it("leave out a machine in the middle of a run, and take it back once the run is done", async () => {
		const machineId = await aMachine({});
		const runId = newId<"run">();
		await handle.sql`
			insert into runs (id, machine_id, occurrence_key, due_at, state, leased_by, lease_expires_at,
				lease_epoch)
			values (${runId}::uuid, ${machineId}::uuid, ${"sweep-test"}, now(), 'leased',
				${newId<"node">()}::uuid, now() + interval '1 minute', 1)`;

		expect(await listed()).not.toContain(machineId);

		await handle.sql`
			update runs set state = 'done', leased_by = null, lease_expires_at = null
			where id = ${runId}::uuid`;
		expect(await listed()).toContain(machineId);
	});
});

describe("a sweep still open", () => {
	it("is named, so it is finished by its own id rather than decided again", async () => {
		const machineId = await aMachine({});
		const sweepId = newId<"sweep">();
		await append(machineId, "sweep.submitted", {
			sweepId,
			signature: "5".repeat(88),
			lastValidBlockHeight: "426070577",
		});

		const candidate = (await sweepCandidates(handle.db)).find((c) => c.machineId === machineId);
		expect(candidate?.openSweepId).toBe(sweepId);
	});

	it("is not named once it is written down as finished", async () => {
		const machineId = await aMachine({});
		const sweepId = newId<"sweep">();
		await append(machineId, "sweep.submitted", {
			sweepId,
			signature: "5".repeat(88),
			lastValidBlockHeight: "426070577",
		});
		await append(machineId, "sweep.failed", {
			sweepId,
			reason: "it expired without reaching the chain",
		});

		const candidate = (await sweepCandidates(handle.db)).find((c) => c.machineId === machineId);
		expect(candidate).toBeDefined();
		expect(candidate?.openSweepId).toBeUndefined();
	});
});
