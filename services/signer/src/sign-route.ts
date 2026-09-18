/**
 * The one way in.
 *
 * Everything that reaches the signer comes through this route, from the orchestrator, with the service
 * token. The route itself does three things and nothing else: it checks the request is well formed, it
 * hands it to the signer, and it turns the answer into a response.
 *
 * It deliberately holds no judgement of its own. Whether a trade is allowed is the signer's decision,
 * made against the record and the machine's rules, and a route is the wrong place to reason about money.
 */

import { SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { Hono } from "hono";

/** What actually signs. The route knows nothing about how. */
export type TradeSigner = {
	sign(request: SignRequest): Promise<SignResponse>;
};

/** Reads the body as a proposal, or says exactly what was wrong with it. */
export function readProposal(body: unknown): SignRequest {
	const parsed = SignRequest.safeParse(body);
	if (parsed.success) return parsed.data;

	const problems = parsed.error.issues.map((issue) => {
		const field = issue.path.join(".") || "(body)";
		return `${field}: ${issue.message}`;
	});
	throw new MaschinaError("invalid_input", `the proposal is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

export function signRoutes(signer: TradeSigner) {
	return new Hono<ServiceEnv>().post("/sign", async (c) => {
		const body = await c.req.json().catch(() => {
			throw new MaschinaError("invalid_input", "the proposal is not JSON");
		});

		const proposal = readProposal(body);
		const answer = await signer.sign(proposal);

		// The answer is checked on the way out too. A malformed response from the signer would be a
		// worse bug than a malformed request, and this is the cheapest place to catch it.
		return c.json(SignResponse.parse(answer), 200);
	});
}
