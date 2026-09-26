/**
 * The one way in.
 *
 * Everything that reaches the signer comes through this route, from the orchestrator, with the service
 * token. The route itself does three things and nothing else: it checks the request is well formed, it
 * hands it to the signer, and it turns the answer into a response.
 *
 * It deliberately holds no judgement of its own. Whether a trade is allowed is the signer's decision,
 * made against the record and the machine's rules, and a route is the wrong place to reason about money.
 *
 * Returning a machine's funds is a separate route because it is a separate thing. A trade is the machine
 * doing its job; a withdrawal is an owner taking their money back. Nothing about a trade's rules or its
 * budget applies, and the shapes have nothing in common but the machine's id.
 */

import { SignRequest, SignResponse, WithdrawRequest, WithdrawResponse } from "@maschina/contracts";
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

/** What returns a machine's funds. Judged entirely inside, the same as a trade. */
export type Withdrawer = {
	withdraw(request: WithdrawRequest): Promise<WithdrawResponse>;
};

/** Reads the body as a withdrawal, or says exactly what was wrong with it. */
export function readWithdrawal(body: unknown): WithdrawRequest {
	const parsed = WithdrawRequest.safeParse(body);
	if (parsed.success) return parsed.data;

	const problems = parsed.error.issues.map((issue) => {
		const field = issue.path.join(".") || "(body)";
		return `${field}: ${issue.message}`;
	});
	throw new MaschinaError("invalid_input", `the withdrawal is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

export function signRoutes(signer: TradeSigner, withdrawer: Withdrawer) {
	return new Hono<ServiceEnv>()
		.post("/sign", async (c) => {
			const body = await c.req.json().catch(() => {
				throw new MaschinaError("invalid_input", "the proposal is not JSON");
			});

			const proposal = readProposal(body);
			const answer = await signer.sign(proposal);

			// The answer is checked on the way out too. A malformed response from the signer would be a
			// worse bug than a malformed request, and this is the cheapest place to catch it.
			return c.json(SignResponse.parse(answer), 200);
		})
		.post("/withdraw", async (c) => {
			const body = await c.req.json().catch(() => {
				throw new MaschinaError("invalid_input", "the withdrawal is not JSON");
			});

			const answer = await withdrawer.withdraw(readWithdrawal(body));
			return c.json(WithdrawResponse.parse(answer), 200);
		});
}
