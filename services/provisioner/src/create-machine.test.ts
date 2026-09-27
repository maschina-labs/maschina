import { newId } from "@maschina/core";
import { SWAP_PROGRAMS, TRANSFER_PROGRAMS, tokenAccountFor } from "@maschina/solana";
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
	settings: {
		spendMint: USDC,
		buyMint: SOL,
		level: "142000000",
		direction: "falls_to",
		amountPerTrade: "5000000",
		slippageBps: 50,
	},
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
						wrapsSol: true,
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
		// A machine that can buy and not sell is not safe to fund, even though nothing leaks.
		["the ability to sell SOL", { wrapsSol: false }],
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
						wrapsSol: true,
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

	it.each([
		["a kind nobody built", { kind: "rnage" }],
		["settings its kind cannot read", { settings: { spendMint: USDC } }],
		[
			"a budget in a token nobody approved",
			{ limits: { ...request.limits, approvedMints: [SOL] as const } },
		],
	])("makes no wallet and writes no machine for %s", async (_what, wrong) => {
		// A wallet is where money goes. It is not made for a machine that could never trade.
		let wallets = 0;
		const provider = createMemoryWalletProvider();
		const { ports: p, written } = ports({
			provider: {
				...provider,
				createWallet: async (ask) => {
					wallets += 1;
					return provider.createWallet(ask);
				},
			},
		});

		const made = await createMachine(p, { ...request, ...wrong });
		expect(made.ok).toBe(false);
		expect(!made.ok && made.error.code).toBe("invalid_input");
		expect(wallets).toBe(0);
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

describe("the vault beside every machine", () => {
	const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

	/** The provider as made, with the vault's stored policy replaced by something else. */
	function vaultReadsBack(wrong: Partial<WalletPolicy>) {
		const provider = createMemoryWalletProvider();
		return ports({
			provider: {
				...provider,
				readPolicy: async (walletId, account) => {
					const stored = await provider.readPolicy(walletId, account);
					if (account !== "vault" || !stored.ok) return stored;
					return { ok: true, value: { ...stored.value, ...wrong } };
				},
			},
		});
	}

	it("is made with the machine, at its own address, and written down", async () => {
		const { ports: p, written } = ports();
		const made = await createMachine(p, request);
		if (!made.ok) throw made.error;

		const machine = written[0] as { wallet: { address: string; vaultAddress?: string } };
		expect(machine.wallet.vaultAddress).toBeDefined();
		expect(machine.wallet.vaultAddress).not.toBe(machine.wallet.address);
	});

	it("cannot call a router, so its key cannot sign a trade", async () => {
		const { ports: p } = ports();
		const made = await createMachine(p, request);
		if (!made.ok) throw made.error;

		const vault = await p.provider.readPolicy(made.value.providerWalletId, "vault");
		if (!vault.ok) throw vault.error;
		expect(vault.value.approvedPrograms).not.toContain(JUPITER);
		expect(vault.value.approvedPrograms).toEqual(Object.keys(TRANSFER_PROGRAMS).sort());
		for (const program of vault.value.approvedPrograms)
			expect(SWAP_PROGRAMS[program]).toBeDefined();
	});

	it("pays tokens only into the owner's own accounts", async () => {
		const { ports: p } = ports();
		const made = await createMachine(p, request);
		if (!made.ok) throw made.error;

		const vault = await p.provider.readPolicy(made.value.providerWalletId, "vault");
		if (!vault.ok) throw vault.error;
		const classic = await tokenAccountFor({ owner: OWNER, mint: USDC });
		expect(vault.value.owner).toBe(OWNER);
		expect(vault.value.recipients).toEqual([]);
		expect(vault.value.tokenDestinations).toContain(classic);
		// Two per token, one under each token program, and every one of them derived from the owner.
		expect(vault.value.tokenDestinations).toHaveLength(request.limits.approvedMints.length * 2);
	});

	it.each([
		[
			"could call a router",
			{ approvedPrograms: [...Object.keys(TRANSFER_PROGRAMS), JUPITER].sort() },
		],
		["pays somewhere other than the owner", { tokenDestinations: [OWNER] }],
		["leaves token destinations open", { tokenDestinations: "any" as const }],
		["pays SOL to somebody else", { recipients: ["BdfAttdWTwGojNRpziKAHNcKpzbgdn3Qe7tpqds19o9n"] }],
		["belongs to another owner", { owner: "BdfAttdWTwGojNRpziKAHNcKpzbgdn3Qe7tpqds19o9n" }],
		["may move SOL beyond the owner", { wrapsSol: true }],
	])("writes no machine when the vault's stored policy %s", async (_what, wrong) => {
		const { ports: p, written } = vaultReadsBack(wrong);
		const made = await createMachine(p, request);

		expect(made.ok).toBe(false);
		expect(!made.ok && made.error.message).toMatch(/vault/i);
		expect(written).toEqual([]);
	});
});
