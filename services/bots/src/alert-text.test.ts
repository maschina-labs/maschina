import { describe, expect, it } from "vitest";
import { alertText } from "./alert-text.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const base = {
	eventId: "e",
	ownerId: "o",
	machineId: "m",
	machineName: "Range Finder",
	occurredAt: "2026-09-29T02:00:00.000Z",
};

describe("an alert as a message", () => {
	it("says what a buy got, and at what price", () => {
		expect(
			alertText({
				...base,
				type: "trade.completed",
				trade: {
					inputMint: USDC,
					outputMint: SOL,
					inputAmount: "40350000",
					outputAmount: "339698787",
				},
				realised: "0",
			}),
		).toBe("Range Finder bought 0.3397 SOL at 118.78 for 40.35 USDC.");
	});

	it("says what a sale got, and what the machine has realised", () => {
		expect(
			alertText({
				...base,
				type: "trade.completed",
				trade: {
					inputMint: SOL,
					outputMint: USDC,
					inputAmount: "339698787",
					outputAmount: "41360000",
				},
				realised: "1010000",
			}),
		).toBe("Range Finder sold 0.3397 SOL at 121.75 for 41.36 USDC. Realised so far: +1.01 USDC.");
	});

	it("says a loss is a loss", () => {
		expect(
			alertText({
				...base,
				type: "trade.completed",
				trade: {
					inputMint: SOL,
					outputMint: USDC,
					inputAmount: "339698787",
					outputAmount: "37100000",
				},
				realised: "-3250000",
			}),
		).toContain("Realised so far: -3.25 USDC.");
	});

	it.each([
		["trade.completed", undefined, "Range Finder made a trade."],
		[
			"trade.failed",
			"blockhash expired",
			"Range Finder tried to trade and it failed. blockhash expired.",
		],
		["trade.refused", "over budget", "Range Finder was refused a trade. over budget."],
		[
			"machine.paused",
			"three runs failed",
			"Range Finder paused itself. three runs failed. It waits for you now.",
		],
		["machine.stopped", undefined, "Range Finder stopped."],
		["withdrawal.completed", undefined, "Range Finder sent its money back to your wallet."],
		["withdrawal.failed", "no SOL", "Range Finder could not send its money back. no SOL."],
		[
			"sweep.completed",
			undefined,
			"Range Finder banked profit in its vault, where it can never be traded.",
		],
		["run.skipped", undefined, "Range Finder: run.skipped."],
	])("says %s plainly", (type, reason, said) => {
		expect(alertText({ ...base, type, ...(reason ? { reason } : {}) })).toBe(said);
	});

	it("names a token it does not know by the start of its address", () => {
		const other = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
		expect(
			alertText({
				...base,
				type: "trade.completed",
				trade: { inputMint: USDC, outputMint: other, inputAmount: "1000000", outputAmount: "5" },
			}),
		).toContain("Dez");
	});
});
