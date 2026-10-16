import { describe, expect, it } from "vitest";
import { CreateMachineRequest } from "./machines.ts";

const OWNER_WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** Everything a machine needs except the one thing each test is about. */
const asked = (over: Record<string, unknown> = {}) => ({
	ownerWallet: OWNER_WALLET,
	name: "Range Finder",
	kind: "range",
	settings: { band: "0.025" },
	limits: { budgetGranted: "40000000", approvedMints: [USDC] },
	...over,
});

describe("asking for a machine", () => {
	it("will not make one without saying whether it is on paper", () => {
		// The difference between pretending and spending is the single most consequential thing about
		// a machine, and it is decided here, once. Leaving it out used to mean live, which is the
		// wrong way round: a mistake should cost nothing, not everything.
		const refused = CreateMachineRequest.safeParse(asked());

		expect(refused.success).toBe(false);
		expect(refused.error?.issues[0]?.path).toEqual(["paper"]);
	});

	it("takes one on paper", () => {
		const read = CreateMachineRequest.safeParse(asked({ paper: true }));

		expect(read.success).toBe(true);
		expect(read.data?.paper).toBe(true);
	});

	it("takes one with real money, said out loud", () => {
		const read = CreateMachineRequest.safeParse(asked({ paper: false }));

		expect(read.success).toBe(true);
		expect(read.data?.paper).toBe(false);
	});

	it("still refuses anything it does not know about", () => {
		expect(CreateMachineRequest.safeParse(asked({ paper: true, mode: "live" })).success).toBe(
			false,
		);
	});
});
