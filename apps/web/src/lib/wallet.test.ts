import { afterEach, describe, expect, it, vi } from "vitest";
import { connect, signMessage } from "./wallet.ts";

/** A stand-in for whatever the extension injects, which is all this module ever talks to. */
function inject(overrides: Partial<Window["solana"]> = {}) {
	const wallet = {
		publicKey: { toString: () => "7xKp4Q9mVbN2sRtL8wEaZc3HfYuD6gJq1oMiTn5vBdRe" },
		connect: vi.fn(async () => ({
			publicKey: { toString: () => "7xKp4Q9mVbN2sRtL8wEaZc3HfYuD6gJq1oMiTn5vBdRe" },
		})),
		signMessage: vi.fn(async () => ({ signature: new Uint8Array([1, 2, 3]) })),
		...overrides,
	} as unknown as NonNullable<Window["solana"]>;
	window.solana = wallet;
	return wallet;
}

afterEach(() => {
	delete window.solana;
	delete window.phantom;
});

describe("the wallet in the browser", () => {
	it("returns the address the wallet offers", async () => {
		inject();
		expect(await connect()).toBe("7xKp4Q9mVbN2sRtL8wEaZc3HfYuD6gJq1oMiTn5vBdRe");
	});

	it("prefers the wallet's own namespace over the shared one", async () => {
		const shared = inject();
		const own = {
			connect: vi.fn(async () => ({ publicKey: { toString: () => "own" } })),
		} as unknown as NonNullable<Window["solana"]>;
		window.phantom = { solana: own };

		expect(await connect()).toBe("own");
		expect(shared.connect).not.toHaveBeenCalled();
	});

	it("says plainly when there is no wallet at all", async () => {
		await expect(connect()).rejects.toThrow(/No Solana wallet/);
		await expect(signMessage("hello")).rejects.toThrow(/No Solana wallet/);
	});

	it("signs a sentence and gives the signature back as base58", async () => {
		const asked: [Uint8Array, string | undefined][] = [];
		inject({
			signMessage: (async (message: Uint8Array, encoding?: string) => {
				asked.push([message, encoding]);
				return { signature: new Uint8Array([1, 2, 3]) };
			}) as never,
		});

		expect(await signMessage("sign in to Maschina")).toBe("Ldp");
		const [message, encoding] = asked[0] as [Uint8Array, string];
		expect(new TextDecoder().decode(message)).toBe("sign in to Maschina");
		// The encoding is named, because a wallet that guesses wrong signs different bytes.
		expect(encoding).toBe("utf8");
	});

	it("takes the bytes whether the wallet wraps them or not", async () => {
		inject({ signMessage: vi.fn(async () => new Uint8Array([1, 2, 3])) as never });
		expect(await signMessage("hello")).toBe("Ldp");
	});
});
