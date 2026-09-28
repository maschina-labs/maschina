import { describe, expect, it } from "vitest";
import { answer } from "./answers.ts";
import type { MachineDetail } from "./machines.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

const machine = {
	state: "running",
	settings: { buyLevel: "118800000", sellLevel: "121200000" },
	result: { position: "339698000", trades: 1, wins: 0, losses: 0, realised: "0" },
} as unknown as MachineDetail;

const bought = [
	{ id: "1", type: "machine.started", occurredAt: "2026-09-28T05:22:33Z", payload: {} },
	{
		id: "2",
		type: "trade.intended",
		occurredAt: "2026-09-28T06:22:36Z",
		payload: { tradeId: "t", inputMint: USDC, outputMint: SOL },
	},
	{
		id: "3",
		type: "trade.completed",
		occurredAt: "2026-09-28T06:22:39Z",
		payload: { tradeId: "t", inputAmount: "40350000", outputAmount: "339698000" },
	},
];

describe("a machine answering for itself", () => {
	it("says why it last traded, from its own buy line", () => {
		expect(answer("WHY DID YOU LAST TRADE?", machine, bought)[0]).toBe(
			"I BOUGHT AT 118.78 BECAUSE THE PRICE REACHED MY BUY LINE AT 118.80.",
		);
	});

	it("says how it stands", () => {
		const said = answer("HOW ARE YOU DOING?", machine, bought);
		expect(said[0]).toBe("I AM RUNNING. HOLDING · SELLS AT 121.20.");
		expect(said[2]).toBe("REALISED 0.00 USDC. HOLDING 0.33 SOL.");
	});

	it("lists what it did, newest first", () => {
		const said = answer("WHAT DID YOU DO?", machine, bought);
		expect(said[0]).toContain("TRADED");
		expect(said.at(-1)).toContain("STARTED");
	});

	it("says so when it has nothing to tell", () => {
		expect(answer("WHY DID YOU LAST TRADE?", machine, [])).toEqual(["I HAVE NOT TRADED YET."]);
		expect(answer("WHAT DID YOU DO?", machine, [])).toEqual(["NOTHING YET. MY RECORD IS EMPTY."]);
	});
});
