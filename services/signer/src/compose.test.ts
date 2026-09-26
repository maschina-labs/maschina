import type { SignRequest } from "@maschina/contracts";
import { newId } from "@maschina/core";
import type { Confirmation } from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { answerFrom, layered } from "./compose.ts";
import type { TradeSigner } from "./sign-route.ts";

const request = { proposalId: newId<"proposal">() } as unknown as SignRequest;

describe("how the signer is put together", () => {
	it("checks the halt first, then the rules, holds the money, and signs last", async () => {
		const order: string[] = [];
		const inner: TradeSigner = {
			sign: async () => {
				order.push("sign");
				return { status: "signed", proposalId: request.proposalId, signature: "5".repeat(88) };
			},
		};
		const signer = layered(inner, {
			haltInForce: async () => {
				order.push("halt checked");
				return undefined;
			},
			factsFor: async () => {
				order.push("rules");
				return undefined;
			},
			recordRefusal: async () => {
				order.push("refusal recorded");
			},
			pauseMachine: async () => {},
			hold: async () => {
				order.push("hold");
				return { reserved: 1n };
			},
			giveBack: async () => {},
		});

		const answer = await signer.sign(request);

		// An unknown machine is refused by the rules before any money is held or anything signed.
		expect(answer.status).toBe("refused");
		// The halt is asked before anything judges the trade, because it is not about the trade.
		expect(order).toEqual(["halt checked", "rules", "refusal recorded"]);
	});
});

describe("reading the chain's answer", () => {
	const signature = "5".repeat(88);

	it.each<[Confirmation, string]>([
		[{ outcome: "landed", signature, slot: 5n, commitment: "confirmed" }, "landed"],
		[{ outcome: "failed", signature, slot: 5n, error: "slippage" }, "failed"],
		[{ outcome: "expired", signature, because: "past its height" }, "expired"],
		[{ outcome: "unknown", signature, because: "rpc down" }, "unknown"],
	])("keeps %o as %s", (confirmation, outcome) => {
		expect(answerFrom(confirmation).outcome).toBe(outcome);
	});

	it("keeps why a trade failed", () => {
		expect(answerFrom({ outcome: "failed", signature, slot: 5n, error: "slippage" })).toEqual({
			outcome: "failed",
			signature,
			reason: "slippage",
		});
	});
});
