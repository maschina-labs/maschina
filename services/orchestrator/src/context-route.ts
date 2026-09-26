/**
 * Telling a node about the run it holds.
 *
 * Everything a node needs to run a machine comes through here, and only while it holds the run. A node
 * whose lease lapsed, or that never held the run, is refused rather than told anything.
 */

import { RunContextRequest, RunContextResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { ServiceEnv } from "@maschina/service";
import { Hono } from "hono";

type RunContext = {
	runId: string;
	machineId: string;
	wallet: string;
	kind: string;
	/** True when this machine only pretends to trade. The node needs it to know which way to go. */
	paper: boolean;
	/** The level that woke this run, for a machine waiting on more than one. */
	wokeOn?: string;
	/** What a machine on paper holds, by mint. Absent for a machine that trades for real. */
	holdings?: Record<string, bigint>;
	settings: unknown;
	dueAt: Date;
	state: string;
	canAct: boolean;
	availableBudget: bigint;
	totals: { spent: bigint; buys: number };
};

/** Where run context comes from. The orchestrator's is the database; tests pass their own. */
export type RunContexts = {
	contextFor(lease: {
		nodeId: string;
		runId: string;
		leaseEpoch: bigint;
	}): Promise<RunContext | undefined>;
};

function readQuestion(body: unknown): RunContextRequest {
	const parsed = RunContextRequest.safeParse(body);
	if (parsed.success) return parsed.data;
	const problems = parsed.error.issues.map(
		(issue) => `${issue.path.join(".") || "(body)"}: ${issue.message}`,
	);
	throw new MaschinaError("invalid_input", `the question is not valid: ${problems.join(", ")}`, {
		details: { problems },
	});
}

export function contextRoutes(contexts: RunContexts) {
	return new Hono<ServiceEnv>().post("/runs/context", async (c) => {
		const body = await c.req.json().catch(() => {
			throw new MaschinaError("invalid_input", "the question is not JSON");
		});
		const question = readQuestion(body);

		const context = await contexts.contextFor({
			nodeId: question.nodeId,
			runId: question.runId,
			leaseEpoch: BigInt(question.leaseEpoch),
		});
		if (!context) throw new MaschinaError("conflict", "this node does not hold the run");

		return c.json(
			RunContextResponse.parse({
				...context,
				...(context.holdings === undefined
					? {}
					: {
							holdings: Object.fromEntries(
								Object.entries(context.holdings).map(([mint, held]) => [mint, held.toString()]),
							),
						}),
				dueAt: context.dueAt.toISOString(),
				availableBudget: context.availableBudget.toString(),
				totals: { spent: context.totals.spent.toString(), buys: context.totals.buys },
			}),
			200,
		);
	});
}
