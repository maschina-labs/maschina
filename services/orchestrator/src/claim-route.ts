/**
 * Handing work to nodes.
 *
 * A node asks for a run and gets one, leased to it, or gets nothing. The queue does the deciding: which
 * run is due, and that two nodes asking at once never get the same one. This route only checks the ask
 * and turns the answer into the contract.
 */

import { ClaimRequest, ClaimResponse } from "@maschina/contracts";
import { MaschinaError, type Result } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { Hono } from "hono";

/** A run as the queue hands it out. */
export type LeasedRun = {
	id: string;
	machineId: string;
	occurrenceKey: string;
	dueAt: Date;
	leaseEpoch: bigint;
	leaseExpiresAt: Date;
};

/** Where runs come from. The orchestrator's is the database; tests pass their own. */
export type RunQueue = {
	claim(nodeId: string): Promise<Result<LeasedRun | undefined, MaschinaError>>;
};

function readClaim(body: unknown): ClaimRequest {
	const parsed = ClaimRequest.safeParse(body);
	if (parsed.success) return parsed.data;
	const problems = parsed.error.issues.map(
		(issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`,
	);
	throw new MaschinaError("invalid_input", `the claim is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

export function claimRoutes(queue: RunQueue) {
	return new Hono<ServiceEnv>().post("/runs/claim", async (c) => {
		const body = await c.req.json().catch(() => {
			throw new MaschinaError("invalid_input", "the claim is not JSON");
		});
		const { nodeId } = readClaim(body);

		const claimed = await queue.claim(nodeId);
		if (!claimed.ok) throw claimed.error;

		const run = claimed.value;
		return c.json(
			ClaimResponse.parse({
				run: run
					? {
							id: run.id,
							machineId: run.machineId,
							occurrenceKey: run.occurrenceKey,
							dueAt: run.dueAt.toISOString(),
							leaseEpoch: run.leaseEpoch.toString(),
							leaseExpiresAt: run.leaseExpiresAt.toISOString(),
						}
					: null,
			}),
			200,
		);
	});
}
