import { newId } from "@maschina/core";
import { createMemoryWalletProvider, type WalletPolicy } from "@maschina/wallet";
import { describe, expect, it } from "vitest";
import {
	type CreateMachinePorts,
	createMachine,
	MAX_LAMPORTS_PER_TRANSFER,
} from "./create-machine.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const OWNER = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

const request = {
	ownerWallet: OWNER,
	name: "SOL dip buyer",
	kind: "price_trigger",
	settings: { spendMint: USDC, buyMint: SOL, level: "142000000", direction: "falls_to" },
	limits: {
		budgetGranted: 20_000_000n,
		maxPerTrade: 5_000_000n,
		approvedMints: [SOL, USDC] as const,
	},
};

function ports(overrides: Partial<CreateMachinePorts> = {}) {
	const written: unknown[] = [];
	const base: CreateMachinePorts = {
		provider: createMemoryWalletProvider(),
		write: async (machine) => {
			written.push(machine);
			return {
				ok: true,
				value: {
					machineId: newId<"machine">(),
					ownerId: newId<"owner">(),
					walletAddress: machine.wallet.address,
					definitionId: "d".repeat(64),
				},
			};
		},
	};
	return { ports: { ...base, ...overrides }, written };
}

describe("creating a machine", () => {
	it("makes a wallet, checks its policy, then writes the machine", async () => {
		const { ports: p, written } = ports();
		const made = await createMachine(p, request);

		expect(made.ok).toBe(true);
		expect(written).toHaveLength(1);
		if (!made.ok) return;
		expect(made.value.walletAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

		// The policy the provider kept must let funds home and nowhere else.
		const policy = await p.provider.readPolicy(made.value.providerWalletId);
		expect(policy.ok && policy.value.owner).toBe(OWNER);
		expect(policy.ok && policy.value.recipients).toEqual([]);
		expect(policy.ok && policy.value.approvedMints).toEqual([SOL, USDC].sort());
	});

	it("writes no machine when the wallet could not be made", async () => {
		const provider = createMemoryWalletProvider();
		const { ports: p, written } = ports({
			provider: {
				...provider,
				createWallet: async () => ({
					ok: false,
					error: { kind: "unavailable", message: "turnkey is down", retryable: true, details: {} },
				}),
			},
		});

		const made = await createMachine(p, request);
		expect(made.ok).toBe(false);
		expect(written).toEqual([]);
	});

	it("writes no machine when the stored policy is not what was asked for", async () => {
		const provider = createMemoryWalletProvider();
		const { ports: p, written } = ports({
			provider: {
				...provider,
				readPolicy: async () => ({
					ok: true,
					value: {
						owner: "SomeoneE1se11111111111111111111111111111111",
						recipients: [],
						approvedPrograms: [],
						approvedMints: [],
						tokenDestinations: "any",
						maxLamportsPerTransfer: 1n,
					},
				}),
			},
		});

		const made = await createMachine(p, request);
		expect(made.ok).toBe(false);
		expect(!made.ok && made.error.message).toMatch(/policy/i);
		expect(written).toEqual([]);
	});

	it.each([
		["the approved tokens", { approvedMints: ["11111111111111111111111111111111"] }],
		// Relative to the cap rather than a number beside it, so raising the cap cannot quietly turn
		// this into a policy that is no longer being checked.
		["the transfer limit", { maxLamportsPerTransfer: MAX_LAMPORTS_PER_TRANSFER + 1n }],
		["the recipients", { recipients: ["3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF"] }],
	])("writes no machine when %s came back wrong", async (_what, wrong) => {
		const provider = createMemoryWalletProvider();
		const { ports: p, written } = ports({
			provider: {
				...provider,
				readPolicy: async () => ({
					ok: true,
					value: {
						owner: OWNER,
						recipients: [],
						approvedPrograms: [],
						approvedMints: [SOL, USDC].sort(),
						tokenDestinations: "any" as const,
						maxLamportsPerTransfer: 20_000_000n,
						...wrong,
					},
				}),
			},
		});

		const made = await createMachine(p, request);
		expect(made.ok).toBe(false);
		expect(written).toEqual([]);
	});

	it("refuses an owner address that is not an address, before touching the provider", async () => {
		const { ports: p, written } = ports();
		const made = await createMachine(p, { ...request, ownerWallet: "nope" });

		expect(made.ok).toBe(false);
		expect(written).toEqual([]);
	});

	it("passes the machine's limits through to the record", async () => {
		const { ports: p, written } = ports();
		await createMachine(p, request);

		expect(written[0]).toMatchObject({
			name: "SOL dip buyer",
			kind: "price_trigger",
			limits: { budgetGranted: 20_000_000n, maxPerTrade: 5_000_000n },
		});
	});
});

describe("the most SOL one transfer may move", () => {
	/** Catches the policy the wallet was actually created with. */
	function policyFor(budgetGranted: bigint) {
		const seen: WalletPolicy[] = [];
		const provider = {
			...createMemoryWalletProvider(),
			createWallet: async (ask: { label: string; policy: WalletPolicy }) => {
				seen.push(ask.policy);
				return createMemoryWalletProvider().createWallet(ask);
			},
		} as CreateMachinePorts["provider"];

		return { seen, made: ports({ provider }), budgetGranted };
	}

	it("is a number in lamports, not a budget in another currency", async () => {
		const { seen, made } = policyFor(50_000_000n);

		// Fifty USDC, at six decimals. Read as lamports that is 0.05 SOL, which is not a limit anybody
		// chose and is far too small to take a machine's funds back in one go.
		await createMachine(made.ports, {
			...request,
			limits: { ...request.limits, budgetGranted: 50_000_000n },
		});

		expect(seen[0]?.maxLamportsPerTransfer).not.toBe(50_000_000n);
		expect(seen[0]?.maxLamportsPerTransfer).toBe(MAX_LAMPORTS_PER_TRANSFER);
	});

	it("does not move when the budget does, because they measure different things", async () => {
		const small = policyFor(1n);
		await createMachine(small.made.ports, {
			...request,
			limits: { ...request.limits, budgetGranted: 1n },
		});
		const large = policyFor(9_000_000_000n);
		await createMachine(large.made.ports, {
			...request,
			limits: { ...request.limits, budgetGranted: 9_000_000_000n },
		});

		expect(small.seen[0]?.maxLamportsPerTransfer).toBe(large.seen[0]?.maxLamportsPerTransfer);
	});

	it("is large enough that a machine's funds are never trapped by it", () => {
		// The only address these funds can reach is the owner's, so a tight cap protects nobody and
		// strands money. It bounds a runaway bug; it is not what stops theft.
		expect(MAX_LAMPORTS_PER_TRANSFER).toBeGreaterThanOrEqual(100_000_000_000n);
	});
});
