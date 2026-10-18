import { baseUnitsOf } from "@maschina/core";
import { describe, expect, it } from "vitest";
import type { WalletBalances } from "./balances.ts";
import { effectsFrom, judgeSwap } from "./derive-effects.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

/** A wallet's holdings, written the short way: lamports and a mint-to-amount map. */
const holding = (lamports: bigint, tokens: Record<string, bigint>): WalletBalances =>
	({
		wallet: WALLET,
		lamports: baseUnitsOf(lamports),
		tokens: Object.entries(tokens).map(([mint, amount]) => ({
			account: `acct-${mint}`,
			mint,
			owner: WALLET,
			amount: baseUnitsOf(amount),
			decimals: mint === SOL ? 9 : 6,
			program: "token" as const,
			frozen: false,
		})),
	}) as unknown as WalletBalances;

/** A buy of SOL with USDC, the shape every claim here takes. */
const buying = (over: Partial<Parameters<typeof judgeSwap>[1]> = {}) => ({
	inputMint: USDC,
	outputMint: SOL,
	inputAmount: 40_350_000n,
	minimumOutputAmount: 330_000_000n,
	lamportsAllowed: 10_000_000n,
	...over,
});

describe("what a transaction did to a wallet", () => {
	it("reports the token that went down and the token that went up", () => {
		const effects = effectsFrom(
			holding(1_000_000_000n, { [USDC]: 50_000_000n, [SOL]: 0n }),
			holding(995_000_000n, { [USDC]: 9_650_000n, [SOL]: 339_000_000n }),
		);

		expect(effects.lamports).toBe(-5_000_000n);
		expect(effects.tokens).toEqual([
			{ mint: USDC, delta: -40_350_000n },
			{ mint: SOL, delta: 339_000_000n },
		]);
	});

	it("leaves out a token that did not move, so only what changed is reported", () => {
		const effects = effectsFrom(
			holding(0n, { [USDC]: 50_000_000n, [BONK]: 7n }),
			holding(0n, { [USDC]: 40_000_000n, [BONK]: 7n }),
		);

		expect(effects.tokens).toEqual([{ mint: USDC, delta: -10_000_000n }]);
	});

	it("counts a token account that did not exist before as starting from nothing", () => {
		// The first buy of a token creates its account, so it has no before-state at all.
		const effects = effectsFrom(
			holding(0n, { [USDC]: 50_000_000n }),
			holding(0n, { [USDC]: 10_000_000n, [SOL]: 339_000_000n }),
		);

		expect(effects.tokens).toContainEqual({ mint: SOL, delta: 339_000_000n });
	});

	it("counts a token account that was closed as going to nothing", () => {
		// Selling the last of a token and closing the account: it is absent afterwards, not zero.
		const effects = effectsFrom(
			holding(0n, { [USDC]: 10_000_000n, [SOL]: 339_000_000n }),
			holding(0n, { [USDC]: 50_000_000n }),
		);

		expect(effects.tokens).toContainEqual({ mint: SOL, delta: -339_000_000n });
	});

	it("adds up two accounts of the same token, because a wallet may hold more than one", () => {
		const before = holding(0n, {});
		(before.tokens as unknown[]).push(
			{
				account: "a",
				mint: USDC,
				owner: WALLET,
				amount: 10n,
				decimals: 6,
				program: "token",
				frozen: false,
			},
			{
				account: "b",
				mint: USDC,
				owner: WALLET,
				amount: 15n,
				decimals: 6,
				program: "token",
				frozen: false,
			},
		);

		const effects = effectsFrom(before, holding(0n, { [USDC]: 5n }));

		expect(effects.tokens).toEqual([{ mint: USDC, delta: -20n }]);
	});
});

describe("whether the deed matches the claim", () => {
	it("accepts a swap that did exactly what it said", () => {
		const effects = effectsFrom(
			holding(1_000_000_000n, { [USDC]: 50_000_000n }),
			holding(995_000_000n, { [USDC]: 9_650_000n, [SOL]: 339_000_000n }),
		);

		expect(judgeSwap(effects, buying())).toEqual({ ok: true });
	});

	it("refuses a transaction that spends more than it claimed", () => {
		// The whole point. The claim says 40.35 USDC, the bytes take 4,035.
		const effects = effectsFrom(
			holding(1_000_000_000n, { [USDC]: 5_000_000_000n }),
			holding(995_000_000n, { [USDC]: 965_000_000n, [SOL]: 339_000_000n }),
		);

		const verdict = judgeSwap(effects, buying());

		expect(verdict.ok).toBe(false);
		expect(!verdict.ok && verdict.rule).toBe("derived_mismatch");
		expect(!verdict.ok && verdict.problem).toMatch(/spent/i);
	});

	it("refuses a transaction that spends a token it never mentioned", () => {
		const effects = effectsFrom(
			holding(0n, { [USDC]: 50_000_000n, [BONK]: 1_000n }),
			holding(0n, { [USDC]: 50_000_000n, [BONK]: 0n, [SOL]: 339_000_000n }),
		);

		const verdict = judgeSwap(effects, buying());

		expect(!verdict.ok && verdict.rule).toBe("derived_mismatch");
	});

	it("refuses when a third token leaves alongside a correct-looking swap", () => {
		// The swap is exactly right, and BONK quietly leaves at the same time.
		const effects = effectsFrom(
			holding(0n, { [USDC]: 50_000_000n, [BONK]: 1_000n }),
			holding(0n, { [USDC]: 9_650_000n, [SOL]: 339_000_000n, [BONK]: 0n }),
		);

		const verdict = judgeSwap(effects, buying());

		expect(!verdict.ok && verdict.rule).toBe("derived_mismatch");
		// It names the mint that leaked and says why a swap never does that.
		expect(!verdict.ok && verdict.problem).toContain(BONK);
		expect(!verdict.ok && verdict.problem).toMatch(/left the wallet/i);
	});

	it("refuses when less came back than the minimum the rules were given", () => {
		const effects = effectsFrom(
			holding(0n, { [USDC]: 50_000_000n }),
			holding(0n, { [USDC]: 9_650_000n, [SOL]: 329_999_999n }),
		);

		const verdict = judgeSwap(effects, buying());

		expect(!verdict.ok && verdict.rule).toBe("derived_mismatch");
		expect(!verdict.ok && verdict.problem).toMatch(/received|minimum/i);
	});

	it("accepts exactly the minimum, because the floor is inclusive", () => {
		const effects = effectsFrom(
			holding(0n, { [USDC]: 50_000_000n }),
			holding(0n, { [USDC]: 9_650_000n, [SOL]: 330_000_000n }),
		);

		expect(judgeSwap(effects, buying())).toEqual({ ok: true });
	});

	it("refuses when more SOL left than fees and rent could explain", () => {
		// Neither leg is SOL here, so nothing explains native lamports leaving but fees and rent.
		const effects = effectsFrom(
			holding(1_000_000_000n, { [USDC]: 50_000_000n }),
			holding(100_000_000n, { [USDC]: 9_650_000n, [BONK]: 339_000_000n }),
		);

		const verdict = judgeSwap(
			effects,
			buying({ outputMint: BONK, minimumOutputAmount: 330_000_000n }),
		);

		expect(!verdict.ok && verdict.rule).toBe("derived_mismatch");
		expect(!verdict.ok && verdict.problem).toMatch(/lamports/i);
	});

	it("allows SOL to arrive, since selling SOL is a swap like any other", () => {
		const effects = effectsFrom(
			holding(0n, { [SOL]: 339_000_000n }),
			holding(0n, { [SOL]: 0n, [USDC]: 41_000_000n }),
		);

		expect(
			judgeSwap(effects, {
				inputMint: SOL,
				outputMint: USDC,
				inputAmount: 339_000_000n,
				minimumOutputAmount: 40_000_000n,
				lamportsAllowed: 10_000_000n,
			}),
		).toEqual({ ok: true });
	});

	it("accepts a buy of SOL that arrives as native lamports, because the router unwraps it", () => {
		// The router is asked to wrap and unwrap, so a bought SOL never appears as a token at all. It
		// lands in the wallet's own balance, minus the fee that balance also paid.
		const effects = effectsFrom(
			holding(1_000_000_000n, { [USDC]: 50_000_000n }),
			holding(1_338_795_000n, { [USDC]: 9_650_000n }),
		);

		expect(judgeSwap(effects, buying())).toEqual({ ok: true });
	});

	it("accepts a sale of SOL paid out of native lamports", () => {
		const effects = effectsFrom(
			holding(1_000_000_000n, {}),
			holding(660_795_000n, { [USDC]: 41_000_000n }),
		);

		expect(
			judgeSwap(effects, {
				inputMint: SOL,
				outputMint: USDC,
				inputAmount: 339_000_000n,
				minimumOutputAmount: 40_000_000n,
				lamportsAllowed: 10_000_000n,
			}),
		).toEqual({ ok: true });
	});

	it("refuses a sale of SOL that took more lamports than the allowance explains", () => {
		// The claim says 0.339 SOL leaves. The wallet is 0.4 SOL lighter, and fees cannot cover that.
		const effects = effectsFrom(
			holding(1_000_000_000n, {}),
			holding(600_000_000n, { [USDC]: 41_000_000n }),
		);

		const verdict = judgeSwap(effects, {
			inputMint: SOL,
			outputMint: USDC,
			inputAmount: 339_000_000n,
			minimumOutputAmount: 40_000_000n,
			lamportsAllowed: 10_000_000n,
		});

		expect(!verdict.ok && verdict.rule).toBe("derived_mismatch");
		expect(!verdict.ok && verdict.problem).toMatch(/spent/i);
	});

	it("refuses a buy of SOL that delivers the token while draining the balance", () => {
		// Wrapped SOL arrives and native SOL quietly leaves. Counted apart, this looks like a good
		// trade; counted as one amount of SOL, which is what the wallet actually holds, it is a loss.
		const effects = effectsFrom(
			holding(1_000_000_000n, { [USDC]: 50_000_000n }),
			holding(100_000_000n, { [USDC]: 9_650_000n, [SOL]: 339_000_000n }),
		);

		const verdict = judgeSwap(effects, buying());

		expect(!verdict.ok && verdict.rule).toBe("derived_mismatch");
		expect(!verdict.ok && verdict.problem).toMatch(/received/i);
	});

	it("holds a SOL sale to the claimed amount, not merely to an upper bound", () => {
		// Spending less than claimed is as much a mismatch as spending more: the budget was reserved
		// against the claim, and a trade that quietly spends half of it is not the trade allowed.
		const effects = effectsFrom(
			holding(1_000_000_000n, {}),
			holding(900_000_000n, { [USDC]: 41_000_000n }),
		);

		const verdict = judgeSwap(effects, {
			inputMint: SOL,
			outputMint: USDC,
			inputAmount: 339_000_000n,
			minimumOutputAmount: 40_000_000n,
			lamportsAllowed: 10_000_000n,
		});

		expect(!verdict.ok && verdict.rule).toBe("derived_mismatch");
	});

	it("refuses a transaction that moves nothing, which is not a trade", () => {
		const effects = effectsFrom(holding(0n, { [USDC]: 50n }), holding(0n, { [USDC]: 50n }));

		expect(judgeSwap(effects, buying()).ok).toBe(false);
	});
});
