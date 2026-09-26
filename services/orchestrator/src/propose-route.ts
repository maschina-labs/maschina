/**
 * A node proposing a trade, for real or on paper.
 *
 * The node never talks to the signer. It proposes here, and the orchestrator checks two things before
 * passing it on: that the node holds the run right now, and that the proposal is for that run's machine.
 * The signer then judges the trade itself, against the record, and its answer comes back unchanged.
 *
 * A machine on paper takes the same journey as far as here and then goes to a different door, because
 * what it is asking for is different: record what this trade would have been. It has no transaction to
 * offer, so it could not be signed for by accident.
 */

import {
	ProposeRequest,
	type SignRequest,
	type SignResponse,
	type SimulateRequest,
	SimulateRouteRequest,
} from "@maschina/contracts";
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
/** The paper signer. A different method because it is handed a different thing. */
export type Simulator = {
	simulate(request: SimulateRequest, leaseEpoch: bigint): Promise<SignResponse>;
};

function read<T>(shape: { safeParse(body: unknown): { success: boolean } }, body: unknown): T {
	const parsed = shape.safeParse(body) as
		| { success: true; data: T }
		| { success: false; error: { issues: { path: unknown[]; message: string }[] } };
	if (parsed.success) return parsed.data;
	const problems = parsed.error.issues.map(
		(issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`,
	);
	throw new MaschinaError("invalid_input", `the proposal is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

/** The two checks every proposal passes, paper or real, before anything is recorded. */
async function heldFor(
	leases: Leases,
	lease: { runId: string; machineId: string; nodeId: string; leaseEpoch: string },
) {
	const held = await leases.holds({
		runId: lease.runId,
		nodeId: lease.nodeId,
		leaseEpoch: BigInt(lease.leaseEpoch),
	});
	if (!held) throw new MaschinaError("conflict", "this node does not hold the run");
	if (held.machineId !== lease.machineId) {
		throw new MaschinaError("forbidden", "the proposal is for another machine than the run's");
	}
	return held;
}

/**
 * Proposing and simulating, side by side.
 *
 * Both pass the same two checks. After that they cannot cross: a machine on paper is refused at the
 * route that signs, and a machine with money is refused at the route that only records. Which one a
 * machine is was decided when it was made, and the node cannot talk it into the other.
 */
export function proposeRoutes(leases: Leases, signer: Signer, paper: Simulator) {
	return new Hono<ServiceEnv>()
		.post("/runs/propose", async (c) => {
			const body = await c.req.json().catch(() => {
				throw new MaschinaError("invalid_input", "the proposal is not JSON");
			});
			const { nodeId, leaseEpoch, proposal } = read<ProposeRequest>(ProposeRequest, body);
			const held = await heldFor(leases, { ...proposal, nodeId, leaseEpoch });
			if (held.paper) {
				throw new MaschinaError(
					"forbidden",
					"this machine runs on paper, so nothing is signed for it",
				);
			}

			return c.json(await signer.sign(proposal), 200);
		})
		.post("/runs/simulate", async (c) => {
			const body = await c.req.json().catch(() => {
				throw new MaschinaError("invalid_input", "the proposal is not JSON");
			});
			const { nodeId, leaseEpoch, proposal } = read<SimulateRouteRequest>(
				SimulateRouteRequest,
				body,
			);
			const held = await heldFor(leases, { ...proposal, nodeId, leaseEpoch });
			// A real machine simulating would write a trade into the record that never happened, and its
			// budget would be spent on nothing.
			if (!held.paper) {
				throw new MaschinaError("forbidden", "this machine trades for real, so it cannot simulate");
			}

			return c.json(await paper.simulate(proposal, BigInt(leaseEpoch)), 200);
		});
}
