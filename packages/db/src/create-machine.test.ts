import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.ts";
import { writeMachine } from "./create-machine.ts";

// Against a real database this is proved in packages/integration-tests. These cover the guards, which
// refuse before anything is written.

const SOL = "So11111111111111111111111111111111111111112";
const OWNER = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

const machine = {
	ownerWallet: OWNER,
	name: "SOL dip buyer",
	kind: "price_trigger",
	settings: {},
	rules: {},
	wallet: { address: SOL, providerWalletId: "wallet-1", provider: "turnkey" },
	limits: { budgetGranted: 20_000_000n, approvedMints: [SOL] },
};

const neverAsked = () =>
	({
		transaction: vi.fn(async () => {
			throw new Error("the database must not be asked");
		}),
	}) as unknown as Database;

describe("writeMachine refuses before it writes", () => {
	it("a machine with no name", async () => {
		const refused = await writeMachine(neverAsked(), { ...machine, name: "  " });
		expect(refused.ok).toBe(false);
	});

	it("a machine with no budget, because it could never act", async () => {
		const refused = await writeMachine(neverAsked(), {
			...machine,
			limits: { ...machine.limits, budgetGranted: 0n },
		});
		expect(refused.ok).toBe(false);
	});

	it("a machine with no approved tokens", async () => {
		const refused = await writeMachine(neverAsked(), {
			...machine,
			limits: { ...machine.limits, approvedMints: [] },
		});
		expect(refused.ok).toBe(false);
	});
});

describe("writeMachine when the database says no", () => {
	const failing = (message: string) =>
		({
			transaction: vi.fn(async () => {
				throw new Error(message);
			}),
		}) as unknown as Database;

	it("calls a wallet already in use a conflict, not a fault", async () => {
		const refused = await writeMachine(
			failing('duplicate key value violates unique constraint "machines_wallet_address_unique"'),
			machine,
		);
		expect(!refused.ok && refused.error.code).toBe("conflict");
	});

	it("calls anything else a fault", async () => {
		const refused = await writeMachine(failing("connection reset"), machine);
		expect(!refused.ok && refused.error.code).toBe("internal");
	});
});
