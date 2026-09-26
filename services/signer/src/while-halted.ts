/**
 * The kill switch, where it actually bites.
 *
 * Outside every other layer, because a halt is not a judgement about a trade. It does not matter whose
 * machine it is, what its budget says or whether the rules would have allowed it: while a halt is in
 * force nothing is signed.
 *
 * This is the layer that makes stopping work without the cooperation of the thing being stopped. A node
 * that keeps proposing, an orchestrator that keeps forwarding, a machine whose settings have gone mad:
 * none of them can move money, because the only thing that can move money asks first.
 *
 * It fails closed. Not being able to tell whether a halt is in force is not the same as there being
 * none, so an unreadable answer refuses too. A switch that fails open is not a switch.
 *
 * Withdrawals do not come through here. A halt that also trapped an owner's funds would be a worse
 * outcome than whatever it was thrown for.
 */

import type { SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { TradeSigner } from "./sign-route.ts";

export type HaltPorts = {
	/** The halt in force right now, if any. Read on every proposal. */
	haltInForce(): Promise<{ reason: string; engagedBy: string } | undefined>;
	/** Writes the refusal, so an owner can see what stopped their machine and why. */
	recordRefusal(
		request: SignRequest,
		refusal: { by: "maschina"; rule: string; reason: string },
	): Promise<void>;
};

export function whileHalted(inner: TradeSigner, ports: HaltPorts): TradeSigner {
	return {
		async sign(request: SignRequest): Promise<SignResponse> {
			let halt: Awaited<ReturnType<HaltPorts["haltInForce"]>>;
			try {
				halt = await ports.haltInForce();
			} catch (cause) {
				throw new MaschinaError(
					"unavailable",
					"cannot tell whether a halt is in force, so nothing is signed",
					{ cause },
				);
			}

			if (!halt) return inner.sign(request);

			const refusal = {
				by: "maschina" as const,
				rule: "halted",
				reason: `everything is halted: ${halt.reason} (${halt.engagedBy})`.slice(0, 500),
			};
			// Written before the answer goes back, and a failure to write it throws rather than quietly
			// letting the trade through. Nothing reaches the signer either way.
			await ports.recordRefusal(request, refusal);
			return { status: "refused", proposalId: request.proposalId, ...refusal };
		},
	};
}
