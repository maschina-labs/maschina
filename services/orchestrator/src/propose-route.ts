/**
 * A node proposing a trade.
 *
 * The node never talks to the signer. It proposes here, and the orchestrator checks two things before
 * passing it on: that the node holds the run right now, and that the proposal is for that run's machine.
 * The signer then judges the trade itself, against the record, and its answer comes back unchanged.
 */

import { ProposeRequest, type SignRequest, type SignResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { Hono } from "hono";

export type Leases = {
	holds(lease: {
		runId: string;
		nodeId: string;
		leaseEpoch: bigint;
	}): Promise<{ machineId: string; paper: boolean } | undefined>;
};

export type Signer = { sign(request: SignRequest): Promise<SignResponse> };

function readProposal(body: unknown): ProposeRequest {
	const parsed = ProposeRequest.safeParse(body);
	if (parsed.success) return parsed.data;
	const problems = parsed.error.issues.map(
		(issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`,
	);
	throw new MaschinaError("invalid_input", `the proposal is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

/**
 * Two signers behind one interface. A machine on paper goes to the one that records and never signs,
 * and every check before this point is the same, which is the whole reason paper is worth anything.
 */
export function proposeRoutes(leases: Leases, signer: Signer, paper: Signer) {
	return new Hono<ServiceEnv>().post("/runs/propose", async (c) => {
		const body = await c.req.json().catch(() => {
			throw new MaschinaError("invalid_input", "the proposal is not JSON");
		});
		const { nodeId, leaseEpoch, proposal } = readProposal(body);

		const held = await leases.holds({
			runId: proposal.runId,
			nodeId,
			leaseEpoch: BigInt(leaseEpoch),
		});
		if (!held) throw new MaschinaError("conflict", "this node does not hold the run");
		if (held.machineId !== proposal.machineId) {
			throw new MaschinaError("forbidden", "the proposal is for another machine than the run's");
		}

		return c.json(await (held.paper ? paper : signer).sign(proposal), 200);
	});
}
