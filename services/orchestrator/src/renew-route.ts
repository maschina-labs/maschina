/**
 * A node keeping its hold on a run.
 *
 * A trade can take longer to settle than a lease lasts. Without renewing, the lease would lapse mid
 * trade and another node could take the run and trade again. So a working node renews on a beat, and a
 * renewal that is refused tells it the run has moved on and it must stop.
 */

import { RenewRequest, RenewResponse } from "@maschina/contracts";
import { MaschinaError, type Result } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { Hono } from "hono";

export type LeaseRenewals = {
	renew(lease: {
		nodeId: string;
		runId: string;
		leaseEpoch: bigint;
	}): Promise<Result<Date, MaschinaError>>;
};

function readRenewal(body: unknown): RenewRequest {
	const parsed = RenewRequest.safeParse(body);
	if (parsed.success) return parsed.data;
	const problems = parsed.error.issues.map(
		(issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`,
	);
	throw new MaschinaError("invalid_input", `the renewal is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

export function renewRoutes(renewals: LeaseRenewals) {
	return new Hono<ServiceEnv>().post("/runs/renew", async (c) => {
		const body = await c.req.json().catch(() => {
			throw new MaschinaError("invalid_input", "the renewal is not JSON");
		});
		const { nodeId, runId, leaseEpoch } = readRenewal(body);

		const renewed = await renewals.renew({ nodeId, runId, leaseEpoch: BigInt(leaseEpoch) });
		if (!renewed.ok) throw renewed.error;
		return c.json(RenewResponse.parse({ leaseExpiresAt: renewed.value.toISOString() }), 200);
	});
}
