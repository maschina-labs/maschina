import { describe, expect, it } from "vitest";
import { canRetire } from "./retire.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** A stopped machine with nothing left in it: the only shape that may be retired. */
const empty = (over: Partial<Parameters<typeof canRetire>[0]> = {}) => ({
	state: "stopped",
	paper: false,
	openTrades: 0,
	trading: { lamports: 890_880n, tokens: [] },
	vault: { lamports: 0n, tokens: [] },
	...over,
});

describe("whether a machine may be retired", () => {
	it("allows a stopped machine with nothing left in it", () => {
		expect(canRetire(empty())).toEqual({ ok: true });
	});

	it("refuses a machine that is still running", () => {
		// Retiring deletes the key. A running machine losing its key mid trade is unrecoverable.
		const verdict = canRetire(empty({ state: "running" }));

		expect(verdict.ok).toBe(false);
		expect(!verdict.ok && verdict.rule).toBe("machine_stopped");
	});

	it("refuses a paused machine, because paused is not finished", () => {
		expect(canRetire(empty({ state: "paused" })).ok).toBe(false);
	});

	it("refuses while a trade is still open", () => {
		// An open trade may still land. Deleting the key first means nothing can ever settle it.
		const verdict = canRetire(empty({ openTrades: 1 }));

		expect(!verdict.ok && verdict.rule).toBe("no_open_trades");
	});

	it("refuses while a token is still held", () => {
		const verdict = canRetire(
			empty({ trading: { lamports: 890_880n, tokens: [{ mint: USDC, amount: 1n }] } }),
		);

		expect(!verdict.ok && verdict.rule).toBe("funds_remain");
		// It names what is left, because the owner has to go and get it.
		expect(!verdict.ok && verdict.reason).toContain(USDC);
	});

	it("refuses while lamports beyond the account's own rent are still there", () => {
		const verdict = canRetire(empty({ trading: { lamports: 900_000n, tokens: [] } }));

		expect(!verdict.ok && verdict.rule).toBe("funds_remain");
	});

	it("allows exactly the rent, which cannot be withdrawn anyway", () => {
		expect(canRetire(empty({ trading: { lamports: 890_880n, tokens: [] } })).ok).toBe(true);
	});

	it("refuses while the vault still holds something", () => {
		// The vault is where profit is swept. It is the owner's money and is easy to forget.
		const verdict = canRetire(
			empty({ vault: { lamports: 0n, tokens: [{ mint: SOL, amount: 5n }] } }),
		);

		expect(!verdict.ok && verdict.rule).toBe("vault_remains");
	});

	it("counts an empty token account as nothing, since closing it is what returns the rent", () => {
		const verdict = canRetire(
			empty({ trading: { lamports: 890_880n, tokens: [{ mint: USDC, amount: 0n }] } }),
		);

		expect(verdict).toEqual({ ok: true });
	});

	it("does not weigh the balances of a paper machine, which has none to weigh", () => {
		// A paper address was generated and its key dropped. Nothing on chain belongs to it, so
		// whatever an RPC says about that address is somebody else's business.
		const verdict = canRetire({
			state: "stopped",
			paper: true,
			openTrades: 0,
			trading: { lamports: 999_000_000n, tokens: [{ mint: USDC, amount: 50n }] },
			vault: { lamports: 0n, tokens: [] },
		});

		expect(verdict).toEqual({ ok: true });
	});

	it("still holds a paper machine to being stopped", () => {
		expect(canRetire({ state: "running", paper: true, openTrades: 0 }).ok).toBe(false);
	});

	it("checks the state before the money, so a running machine is never priced", () => {
		const verdict = canRetire(
			empty({ state: "running", trading: { lamports: 9_000_000n, tokens: [] } }),
		);

		expect(!verdict.ok && verdict.rule).toBe("machine_stopped");
	});
});
