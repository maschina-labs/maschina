/**
 * Holding the money before signing, and giving it back when nothing happened.
 *
 * The rules already asked whether a trade fits the budget. This asks the database to hold it, which is a
 * different question: the first is an opinion about a moment that has passed, the second is a fact that
 * two trades cannot both get. Under load that difference is the whole thing, so the reservation is what
 * decides, not the check.
 *
 * The order is deliberate and never changes:
 *
 *   hold the money  ->  sign  ->  (later, elsewhere) settle what it really cost
 *                           \->  refused or broken: give it straight back
 *
 * Reserving first means a crash between the two leaves money held for a trade that never happened, which
 * recovery releases. The other order leaves a signed transaction nobody reserved for, and that is money
 * gone from a budget that never knew about it.
 */

import type { SignRequest, SignResponse } from "@maschina/contracts";
import { isMaschinaError } from "@maschina/core";
import type { TradeSigner } from "./sign-route.ts";

export type BudgetLedger = {
	/**
	 * Holds what the trade could cost. Returns nothing when the budget cannot cover it, which is a
	 * refusal rather than a failure.
	 */
	hold(request: SignRequest): Promise<{ reserved: bigint } | undefined>;
	/** Gives the held money back, for a trade that certainly did not happen. */
	giveBack(request: SignRequest, reason: string): Promise<void>;
};

/**
 * Wraps a signer so nothing is signed without the money being held first.
 *
 * A trade that comes back refused releases its hold, because a refusal is proof it did not happen. A
 * trade that fails on the way to being signed releases too. Anything after a signature exists does not
 * release: that money may already be spent, and only the chain can say.
 */
export function withBudget(inner: TradeSigner, ledger: BudgetLedger): TradeSigner {
	return {
		async sign(request: SignRequest): Promise<SignResponse> {
			const held = await ledger.hold(request);

			if (!held) {
				return {
					status: "refused",
					proposalId: request.proposalId,
					by: "maschina",
					rule: "budget",
					reason: "the budget could not hold what this trade would cost",
				};
			}

			let answer: SignResponse;
			try {
				answer = await inner.sign(request);
			} catch (error) {
				// Nothing was signed, so nothing can have happened. The money goes back and the failure
				// carries on being a failure.
				await ledger.giveBack(request, whyItFailed(error));
				throw error;
			}

			if (answer.status === "refused") {
				await ledger.giveBack(request, `refused by ${answer.by}: ${answer.rule}`);
			}

			return answer;
		},
	};
}

const whyItFailed = (error: unknown): string => {
	if (isMaschinaError(error)) return `${error.code}: ${error.message}`;
	return error instanceof Error ? error.message : String(error);
};
