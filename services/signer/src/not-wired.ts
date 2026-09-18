/**
 * The signer before it can sign.
 *
 * The route, its shape and its authentication are built; what happens after a proposal is accepted is
 * being built behind it, rule by rule. Until that is finished this stands in, and it refuses everything.
 *
 * It refuses rather than pretends, and it refuses with `unavailable`, which the run loop treats as
 * something to try again later rather than a reason to pause a machine. A stand-in that answered
 * "signed" would be the single worst bug this codebase could have.
 */

import type { SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { TradeSigner } from "./sign-route.ts";

export const notWiredYet: TradeSigner = {
	async sign(_request: SignRequest): Promise<SignResponse> {
		throw new MaschinaError("unavailable", "the signer cannot sign yet");
	},
};
