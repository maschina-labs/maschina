import { ok } from "@maschina/core";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { writeMachine } from "./create-machine.ts";

// What writeMachine hands the database, without one. Against real Postgres it is proved in
// packages/integration-tests; this pins the shape of what is written.

const appended: { type: string; payload: Record<string, unknown> }[] = [];

vi.mock("./owners.ts", () => ({
	createOwner: async () => ok({ id: "0199a0a0-0000-7000-8000-000000000001" }),
}));
vi.mock("./definitions.ts", () => ({
	saveDefinition: async () => ok({ id: "d".repeat(64) }),
}));
vi.mock("./record.ts", () => ({
	appendEvent: async (_tx: unknown, event: { type: string; payload: Record<string, unknown> }) => {
		appended.push(event);
		return ok(undefined);
	},
}));

const SOL = "So11111111111111111111111111111111111111112";
const WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const VAULT = "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk";

const dialect = new PgDialect();

/** A database that runs the transaction and keeps every statement it was given, with its values. */
function recording() {
	const statements: { sql: string; params: unknown[] }[] = [];
	const tx = {
		execute: async (query: SQL) => {
			statements.push(dialect.sqlToQuery(query));
			return [];
		},
	};
	const db = {
		transaction: async (run: (t: typeof tx) => unknown) => run(tx),
	} as unknown as Database;
	return { db, statements };
}

const machine = (wallet: { address: string; vaultAddress?: string }) => ({
	ownerWallet: WALLET,
	name: "SOL range",
	kind: "range",
	settings: {},
	rules: {},
	wallet: { ...wallet, providerWalletId: "wallet-1", provider: "turnkey" },
	limits: { budgetGranted: 50_000_000n, approvedMints: [SOL] },
});

beforeEach(() => {
	appended.length = 0;
});

describe("what writeMachine writes", () => {
	it("puts the vault in the row and in the record", async () => {
		const { db, statements } = recording();
		const written = await writeMachine(db, machine({ address: SOL, vaultAddress: VAULT }));

		expect(written.ok).toBe(true);
		expect(statements[0]?.sql).toMatch(/vault_address/);
		expect(statements[0]?.params).toContain(VAULT);
		const created = appended.find((event) => event.type === "machine.created");
		expect(created?.payload["vaultAddress"]).toBe(VAULT);
	});

	it("writes no vault for a machine that has none, and says nothing about one in the record", async () => {
		const { db, statements } = recording();
		await writeMachine(db, machine({ address: SOL }));

		expect(statements[0]?.params).toContain(null);
		const created = appended.find((event) => event.type === "machine.created");
		expect(created?.payload).not.toHaveProperty("vaultAddress");
	});

	it("records every limit the owner set", async () => {
		const { db } = recording();
		await writeMachine(db, {
			...machine({ address: SOL }),
			limits: { budgetGranted: 50_000_000n, maxPerTrade: 5n, maxPerDay: 10n, approvedMints: [SOL] },
		});

		const limits = appended
			.filter((event) => event.type === "machine.limits_changed")
			.map((event) => event.payload["limit"]);
		expect(limits.sort()).toEqual(["approvedMints", "budgetGranted", "maxPerDay", "maxPerTrade"]);
	});
});
