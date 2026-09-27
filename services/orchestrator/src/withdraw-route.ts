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
 *
 * These routes answer the gateway alone, acting for a signed in owner, and never a node. They used to sit
 * behind the daemon's token: a node could only ever have paid the owner, so nothing could be stolen, but
 * it had no business deciding when an owner's money moves.
 */

import {
	WithdrawEverythingRequest,
	type WithdrawEverythingResponse,
	WithdrawRequest,
	type WithdrawResponse,
} from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { Hono } from "hono";
import type { z } from "zod";

/** Where a machine's state comes from. The orchestrator's is the record. */
export type MachineStates = {
	stateOf(machineId: string): Promise<string | undefined>;
};

export type Withdrawer = {
	withdraw(request: WithdrawRequest): Promise<WithdrawResponse>;
	/** Every token and all the SOL, from the trading account and the vault, to the owner. */
	withdrawEverything(request: WithdrawEverythingRequest): Promise<WithdrawEverythingResponse>;
};

/** A machine in any of these is not about to trade, so its wallet can be emptied safely. */
const SETTLED = new Set(["draft", "ready", "paused", "stopped"]);

function read<T>(schema: z.ZodType<T>, body: unknown): T {
	const parsed = schema.safeParse(body);
	if (parsed.success) return parsed.data;
	const problems = parsed.error.issues.map(
		(issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`,
	);
	throw new MaschinaError("invalid_input", `the withdrawal is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

/** The one check a withdrawal makes of its own: the machine has stopped acting. */
async function mustBeSettled(states: MachineStates, machineId: string): Promise<void> {
	const state = await states.stateOf(machineId);
	if (state === undefined) {
		throw new MaschinaError("not_found", "there is no machine by that id");
	}
	if (!SETTLED.has(state)) {
		throw new MaschinaError(
			"conflict",
			`this machine is ${state}, so pause or stop it before taking its funds`,
			{ details: { machineId, state } },
		);
	}
}

export function withdrawRoutes(states: MachineStates, withdrawer: Withdrawer) {
	const json = async (c: { req: { json(): Promise<unknown> } }) =>
		c.req.json().catch(() => {
			throw new MaschinaError("invalid_input", "the withdrawal is not JSON");
		});

	return new Hono<ServiceEnv>()
		.post("/withdraw", async (c) => {
			const request = read(WithdrawRequest, await json(c));
			await mustBeSettled(states, request.machineId);
			return c.json(await withdrawer.withdraw(request), 200);
		})
		.post("/withdraw-everything", async (c) => {
			const request = read(WithdrawEverythingRequest, await json(c));
			await mustBeSettled(states, request.machineId);
			return c.json(await withdrawer.withdrawEverything(request), 200);
		});
}
