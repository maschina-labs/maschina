import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import {
	type Commitment,
	type ConfirmationReader,
	confirmSignature,
	didItLand,
	isAtLeast,
	type SignatureStatus,
} from "./confirm.ts";

const SIGNATURE =
	"2gCEqMVor2LxnpCrgWjhrDMfYF7nfM73f947HkZotuzaMrmd1xff2Bq4eF8z6VPVsSzRse1mvDaTj2sdPZsFCY4X";
const EXPIRES_AT = 1000n;

const status = (over: Partial<SignatureStatus> = {}): SignatureStatus => ({
	slot: 499_906_176n,
	commitment: "confirmed",
	...over,
});

/**
 * A chain that answers with a scripted sequence, and remembers what it was asked.
 * Each answer is used once, and the last one repeats.
 */
function fakeChain(options: { statuses: (SignatureStatus | undefined)[]; heights?: bigint[] }) {
	const asked: { searchHistory: boolean }[] = [];
	let statusCalls = 0;
	let heightCalls = 0;

	const reader: ConfirmationReader = {
		async statusOf(_signature, searchHistory) {
			asked.push({ searchHistory });
			const answer = options.statuses[Math.min(statusCalls, options.statuses.length - 1)];
			statusCalls += 1;
			return answer;
		},
		async blockHeight() {
			const heights = options.heights ?? [0n];
			const answer = heights[Math.min(heightCalls, heights.length - 1)] ?? 0n;
			heightCalls += 1;
			return answer;
		},
	};

	return {
		reader,
		asked,
		get statusCalls() {
			return statusCalls;
		},
		get heightCalls() {
			return heightCalls;
		},
	};
}

/** Waiting, with no actual waiting. */
const noSleep = () => Promise.resolve();

describe("how settled an answer is", () => {
	it.each([
		["finalized", "confirmed", true],
		["confirmed", "confirmed", true],
		["processed", "confirmed", false],
		["confirmed", "finalized", false],
		["processed", "processed", true],
	])("%s is at least %s: %s", (got, wanted, expected) => {
		expect(isAtLeast(got as Commitment, wanted as Commitment)).toBe(expected);
	});
});

describe("waiting for a transaction", () => {
	it("says it landed once the chain is settled enough", async () => {
		const chain = fakeChain({ statuses: [status({ commitment: "confirmed" })] });

		const result = await confirmSignature(
			chain.reader,
			{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT },
			{ sleep: noSleep },
		);

		expect(result).toMatchObject({
			outcome: "landed",
			slot: 499_906_176n,
			commitment: "confirmed",
		});
		expect(chain.asked[0]?.searchHistory).toBe(false);
	});

	it("keeps waiting while the answer is not settled enough yet", async () => {
		const chain = fakeChain({
			statuses: [status({ commitment: "processed" }), status({ commitment: "finalized" })],
		});

		const result = await confirmSignature(
			chain.reader,
			{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT, wait: "finalized" },
			{ sleep: noSleep },
		);

		expect(result.outcome).toBe("landed");
		expect(chain.statusCalls).toBe(2);
	});

	it("says it failed when the transaction landed and then failed", async () => {
		const chain = fakeChain({ statuses: [status({ error: '{"InstructionError":[3,"Custom"]}' })] });

		const result = await confirmSignature(
			chain.reader,
			{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT },
			{ sleep: noSleep },
		);

		expect(result).toMatchObject({ outcome: "failed", error: '{"InstructionError":[3,"Custom"]}' });
	});

	it("only calls it expired once the chain has moved past its expiry", async () => {
		const chain = fakeChain({ statuses: [undefined], heights: [999n, 1000n, 1001n] });

		const result = await confirmSignature(
			chain.reader,
			{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT },
			{ sleep: noSleep },
		);

		expect(result.outcome).toBe("expired");
		// Not at 999, not at 1000, only once the height is past it.
		expect(chain.heightCalls).toBe(3);
	});

	it("reads the status before believing an expiry, because both can happen at once", async () => {
		// The chain is past the expiry height, and the transaction landed anyway.
		const chain = fakeChain({ statuses: [status()], heights: [5000n] });

		const result = await confirmSignature(
			chain.reader,
			{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT },
			{ sleep: noSleep },
		);

		expect(result.outcome).toBe("landed");
		expect(chain.heightCalls).toBe(0);
	});

	it("gives up as unknown rather than guessing", async () => {
		const chain = fakeChain({ statuses: [undefined], heights: [1n] });
		let clock = 0;

		const result = await confirmSignature(
			chain.reader,
			{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT },
			{
				sleep: async () => {
					clock += 1000;
				},
				now: () => clock,
				timeoutMs: 3000,
				pollMs: 1000,
			},
		);

		expect(result).toMatchObject({ outcome: "unknown" });
		expect(result).toMatchObject({ because: expect.stringContaining("3 seconds") });
	});

	it("refuses to wait with nonsense timings", async () => {
		const chain = fakeChain({ statuses: [status()] });

		await expect(
			confirmSignature(
				chain.reader,
				{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT },
				{ timeoutMs: 0 },
			),
		).rejects.toThrow(MaschinaError);
		await expect(
			confirmSignature(
				chain.reader,
				{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT },
				{ pollMs: -1 },
			),
		).rejects.toThrow(MaschinaError);
	});
});

describe("asking the chain after a crash", () => {
	it("searches history, because a node forgets recent signatures fast", async () => {
		const chain = fakeChain({ statuses: [status({ commitment: "finalized" })] });

		const result = await didItLand(chain.reader, SIGNATURE);

		expect(result).toMatchObject({ outcome: "landed", commitment: "finalized" });
		expect(chain.asked[0]?.searchHistory).toBe(true);
	});

	it("reports a transaction that landed and failed as having happened", async () => {
		const chain = fakeChain({ statuses: [status({ error: "InsufficientFunds" })] });

		expect(await didItLand(chain.reader, SIGNATURE)).toMatchObject({
			outcome: "failed",
			error: "InsufficientFunds",
		});
	});

	it("treats a missing signature as unknown when nothing proves it cannot land", async () => {
		const chain = fakeChain({ statuses: [undefined], heights: [500n] });

		expect(await didItLand(chain.reader, SIGNATURE, EXPIRES_AT)).toMatchObject({
			outcome: "unknown",
		});
	});

	it("is unknown when there is no expiry to judge against, never 'did not happen'", async () => {
		const chain = fakeChain({ statuses: [undefined] });

		expect(await didItLand(chain.reader, SIGNATURE)).toMatchObject({ outcome: "unknown" });
		expect(chain.heightCalls).toBe(0);
	});

	it("only says it did not happen once it can never happen", async () => {
		const chain = fakeChain({ statuses: [undefined], heights: [1001n] });

		expect(await didItLand(chain.reader, SIGNATURE, EXPIRES_AT)).toMatchObject({
			outcome: "expired",
		});
	});
});

describe("the last check before calling a transaction dead", () => {
	it("searches history before believing an expiry", async () => {
		// The recent cache has nothing, the chain is past the expiry, but it did land a while ago.
		const chain = fakeChain({
			statuses: [undefined, status({ commitment: "finalized" })],
			heights: [1001n],
		});

		const result = await confirmSignature(
			chain.reader,
			{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT },
			{ sleep: noSleep },
		);

		expect(result.outcome).toBe("landed");
		expect(chain.asked[0]?.searchHistory).toBe(false);
		expect(chain.asked[1]?.searchHistory).toBe(true);
	});

	it("reports a failure found by that search as a failure", async () => {
		const chain = fakeChain({
			statuses: [undefined, status({ error: "InstructionError" })],
			heights: [1001n],
		});

		expect(
			await confirmSignature(
				chain.reader,
				{ signature: SIGNATURE, lastValidBlockHeight: EXPIRES_AT },
				{ sleep: noSleep },
			),
		).toMatchObject({ outcome: "failed", error: "InstructionError" });
	});
});
