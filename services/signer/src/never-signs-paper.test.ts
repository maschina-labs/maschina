import { describe, expect, it, vi } from "vitest";
import { neverSignsPaper, PAPER_WALLET_PREFIX } from "./never-signs-paper.ts";

/** A provider that says yes to everything, so the only refusal under test is the wrapper's. */
const willing = () => ({
	name: "turnkey",
	createWallet: vi.fn(async () => ({ ok: true as const, value: {} })),
	readPolicy: vi.fn(async () => ({ ok: true as const, value: {} })),
	sign: vi.fn(async () => ({ ok: true as const, value: new Uint8Array([1]) })),
	setRecipients: vi.fn(async () => ({ ok: true as const, value: {} })),
});

const paper = `${PAPER_WALLET_PREFIX}7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU`;
const real = "turnkey-wallet-1";

describe("a paper machine's wallet never reaches the provider", () => {
	it("refuses to sign for one, and does not ask the provider at all", async () => {
		const inner = willing();

		const result = await neverSignsPaper(inner as never).sign(paper, new Uint8Array([1]));

		expect(result.ok).toBe(false);
		expect(inner.sign).not.toHaveBeenCalled();
	});

	it("says plainly what happened, so nobody debugs the provider for an hour", async () => {
		const result = await neverSignsPaper(willing() as never).sign(paper, new Uint8Array([1]));

		expect(!result.ok && String(result.error.message)).toMatch(/paper/i);
	});

	it("refuses every other thing that could be asked of it too", async () => {
		const inner = willing();
		const wrapped = neverSignsPaper(inner as never);

		expect((await wrapped.readPolicy(paper)).ok).toBe(false);
		expect((await wrapped.setRecipients(paper, [])).ok).toBe(false);
		expect(inner.readPolicy).not.toHaveBeenCalled();
		expect(inner.setRecipients).not.toHaveBeenCalled();
	});

	it("passes a real wallet straight through, untouched", async () => {
		const inner = willing();
		const wrapped = neverSignsPaper(inner as never);
		const transaction = new Uint8Array([1, 2, 3]);

		expect((await wrapped.sign(real, transaction)).ok).toBe(true);
		expect(inner.sign).toHaveBeenCalledWith(real, transaction, undefined);
		expect((await wrapped.readPolicy(real)).ok).toBe(true);
	});

	it("keeps the provider's own name, because it is still that provider", () => {
		expect(neverSignsPaper(willing() as never).name).toBe("turnkey");
	});
});
