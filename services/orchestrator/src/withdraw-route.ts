/**
 * An owner asking for a machine's funds back.
 *
 * The orchestrator is the only thing that talks to the signer, so a withdrawal comes through here even
 * though it is not a run. It checks one thing of its own and forwards the rest: the signer decides where
 * the money goes and whether it may move at all.
 *
 * The one check is that the machine has stopped acting. A running machine may have a trade in flight
 * with money committed to it, and taking the wallet out from under a signed trade leaves a transaction
 * that cannot pay for itself. So an owner pauses or stops first, which is also the order #82 asks for.
 */

import { WithdrawRequest, type WithdrawResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { Hono } from "hono";

/** Where a machine's state comes from. The orchestrator's is the record. */
export type MachineStates = {
	stateOf(machineId: string): Promise<string | undefined>;
};

export type Withdrawer = {
	withdraw(request: WithdrawRequest): Promise<WithdrawResponse>;
};

/** A machine in any of these is not about to trade, so its wallet can be emptied safely. */
const SETTLED = new Set(["draft", "ready", "paused", "stopped"]);

function readWithdrawal(body: unknown): WithdrawRequest {
	const parsed = WithdrawRequest.safeParse(body);
	if (parsed.success) return parsed.data;
	const problems = parsed.error.issues.map(
		(issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`,
	);
	throw new MaschinaError("invalid_input", `the withdrawal is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

export function withdrawRoutes(states: MachineStates, withdrawer: Withdrawer) {
	return new Hono<ServiceEnv>().post("/withdraw", async (c) => {
		const body = await c.req.json().catch(() => {
			throw new MaschinaError("invalid_input", "the withdrawal is not JSON");
		});
		const request = readWithdrawal(body);

		const state = await states.stateOf(request.machineId);
		if (state === undefined) {
			throw new MaschinaError("not_found", "there is no machine by that id");
		}
		if (!SETTLED.has(state)) {
			throw new MaschinaError(
				"conflict",
				`this machine is ${state}, so pause or stop it before taking its funds`,
				{ details: { machineId: request.machineId, state } },
			);
		}

		return c.json(await withdrawer.withdraw(request), 200);
	});
}
