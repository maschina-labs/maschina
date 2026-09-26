import type { SignRequest, SignResponse } from "@maschina/contracts";
import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import type { TradeSigner } from "./sign-route.ts";
import { whileHalted } from "./while-halted.ts";

const proposal = {
	proposalId: newId<"proposal">(),
	runId: newId<"run">(),
	tradeId: newId<"trade">(),
	machineId: newId<"machine">(),
	wallet: "8GF3GqdXLFeojSUeYgNWVDFoua5jUx8fxjg3iTT3PWuk",
	transaction: "AAAA",
	lastValidBlockHeight: "1000",
	trade: {
		inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		outputMint: "So11111111111111111111111111111111111111112",
		inputAmount: "5000000",
		quotedOutputAmount: "41000000",
		minimumOutputAmount: "40000000",
		slippageBps: 50,
		router: "jupiter",
	},
} satisfies SignRequest;

const signed: SignResponse = {
	status: "signed",
	proposalId: proposal.proposalId,
	signature: "5".repeat(88),
};

const halt = {
	id: newId<"halt">(),
	reason: "the price feed is lying",
	engagedBy: "ash",
	engagedAt: new Date("2026-09-26T09:00:00Z"),
};

describe("signing while the kill switch is on", () => {
	it("refuses, and never asks the thing that signs", async () => {
		const sign = vi.fn(async () => signed);
		const recordRefusal = vi.fn(async () => undefined);

		const answer = await whileHalted({ sign } as TradeSigner, {
			haltInForce: async () => halt,
			recordRefusal,
		}).sign(proposal);

		expect(answer).toMatchObject({ status: "refused", by: "maschina", rule: "halted" });
		// The point of a kill switch: it does not ask nicely, and it does not depend on the thing being
		// stopped behaving.
		expect(sign).not.toHaveBeenCalled();
	});

	it("says why it was halted, so the refusal is readable months later", async () => {
		const answer = await whileHalted({ sign: async () => signed } as TradeSigner, {
			haltInForce: async () => halt,
			recordRefusal: async () => undefined,
		}).sign(proposal);

		expect(JSON.stringify(answer)).toContain("the price feed is lying");
	});

	it("writes the refusal to the record, because an unrecorded refusal is a lie", async () => {
		const recordRefusal = vi.fn(async () => undefined);

		await whileHalted({ sign: async () => signed } as TradeSigner, {
			haltInForce: async () => halt,
			recordRefusal,
		}).sign(proposal);

		expect(recordRefusal).toHaveBeenCalledWith(
			proposal,
			expect.objectContaining({ rule: "halted" }),
		);
	});

	it("refuses even if the record cannot be written, rather than signing", async () => {
		const sign = vi.fn(async () => signed);

		const answer = await whileHalted({ sign } as TradeSigner, {
			haltInForce: async () => halt,
			recordRefusal: async () => {
				throw new Error("the database is down");
			},
		})
			.sign(proposal)
			.catch(() => ({ status: "threw" }));

		// Whatever happened, nothing was signed. A halt that fails open is not a halt.
		expect(sign).not.toHaveBeenCalled();
		expect(answer).toBeDefined();
	});

	it("passes the proposal straight through when nothing is halted", async () => {
		const sign = vi.fn(async () => signed);

		const answer = await whileHalted({ sign } as TradeSigner, {
			haltInForce: async () => undefined,
			recordRefusal: async () => undefined,
		}).sign(proposal);

		expect(answer).toEqual(signed);
		expect(sign).toHaveBeenCalledOnce();
	});

	it("refuses when it cannot tell whether anything is halted", async () => {
		const sign = vi.fn(async () => signed);

		const answer = await whileHalted({ sign } as TradeSigner, {
			haltInForce: async () => {
				throw new Error("the database is down");
			},
			recordRefusal: async () => undefined,
		})
			.sign(proposal)
			.catch((error: unknown) => error);

		// Not knowing is not the same as knowing it is fine. A switch that fails open is worthless.
		expect(sign).not.toHaveBeenCalled();
		expect(String(answer)).toContain("halt");
	});
});
