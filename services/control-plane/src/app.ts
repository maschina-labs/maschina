/**
 * The control plane. `06-NODES` §3, option C.
 *
 * Three things live here and nowhere else, because they are the three that must
 * not be distributed:
 *
 *   the event log        the single source of truth (P9)
 *   the capability check the authority decision (P1, P3)
 *   the secret broker    credentials, from slice 6
 *
 * Everything else is compute and belongs wherever the work is.
 *
 * **This is the only process with a database connection.** A node reaches it
 * over HTTP and cannot reach Postgres at all, which is checked in CI by
 * `.github/ci/check-node-boundary.mjs` rather than left to discipline. If a node
 * could talk to the database directly, the authority check would be advice.
 */

import type {
	AuthorizationRequest,
	Event,
	ModelClass,
	NewEvent,
	Operation,
	ReadOptions,
	Verdict,
} from "@maschina/core";
import type { Lease } from "@maschina/db";
import {
	acquireLease,
	authorize,
	Fenced,
	getCapability,
	getLease,
	getObjective,
	grant,
	listCapabilities,
	listObjectives,
	append as logAppend,
	read as logRead,
	recordEvaluation,
	releaseLease,
	renewLease,
	reserve,
	revoke,
	settle,
	takeObjective,
} from "@maschina/db";
import { Hono } from "hono";
import type { Pool } from "pg";
import { callEstimate } from "./config.ts";
import type { ModelRequest, ModelResult } from "./model.ts";
import { invokeModel, ModelCallRefused } from "./model.ts";
import { performRepositoryEffect, RepositoryRefused, reconcile } from "./repository.ts";

/**
 * Event ids and epochs are bigints, and JSON has no bigint. They go over the
 * wire as strings and are parsed back on the other side.
 *
 * Numbers would be lossy above 2^53 and the loss would be silent, which is the
 * worst failure shape available for an identifier that orders the log.
 */
function wireEvent(event: Event): Record<string, unknown> {
	return {
		id: event.id.toString(),
		recordedAt: event.recordedAt.toISOString(),
		actor: event.actor,
		objective: event.objective,
		type: event.type,
		payload: event.payload,
		epoch: event.epoch.toString(),
		causation: event.causation === null ? null : event.causation.toString(),
	};
}

/**
 * How a model call is actually made.
 *
 * Injectable for one reason: the real one needs the model provider's credential
 * on the machine, and a shared CI runner has none and no business holding one. Everything Maschina does around a model call, the authority check, the
 * reservation, the settlement arithmetic, the refusal when a budget cannot fund
 * another call, is Maschina's logic and should not need money or a network to
 * demonstrate. What the real provider does is proven separately, against the
 * real provider, by whoever has one.
 */
export type ModelInvoker = (request: ModelRequest) => Promise<ModelResult>;

/** Epochs are bigints and JSON has none, same as event ids. */
function wireLease(lease: Lease): Record<string, unknown> {
	return {
		worker: lease.worker,
		node: lease.node,
		epoch: lease.epoch.toString(),
		expiresAt: lease.expiresAt.toISOString(),
		heldSince: lease.heldSince.toISOString(),
	};
}

export function createApp(pool: Pool, invoke: ModelInvoker = invokeModel): Hono {
	const app = new Hono();

	app.get("/health", (c) => c.json({ ok: true }));

	// ── The log ───────────────────────────────────────────────────────────────

	app.post("/events", async (c) => {
		const body = (await c.req.json()) as {
			actor: string;
			type: string;
			objective?: string | null;
			payload?: Record<string, unknown>;
			epoch?: string;
			causation?: string | null;
		};

		const event: NewEvent = {
			actor: body.actor,
			type: body.type,
			objective: body.objective ?? null,
			payload: body.payload ?? {},
			epoch: body.epoch === undefined ? 0n : BigInt(body.epoch),
			causation: body.causation == null ? null : BigInt(body.causation),
		};

		try {
			return c.json(wireEvent(await logAppend(pool, event)), 201);
		} catch (error: unknown) {
			// A fenced write is an answer, not a server fault. 409 says "somebody
			// else owns this now", which is a thing the caller can act on, where a
			// 500 would read as "try again" and produce exactly the duplicate
			// execution fencing exists to prevent.
			if (error instanceof Fenced) {
				return c.json({ fenced: true, detail: error.message }, 409);
			}
			throw error;
		}
	});

	app.get("/events", async (c) => {
		const { objective, actor, after, limit } = c.req.query();
		const options: ReadOptions = {
			...(objective !== undefined ? { objective } : {}),
			...(actor !== undefined ? { actor } : {}),
			...(after !== undefined ? { after: BigInt(after) } : {}),
			...(limit !== undefined ? { limit: Number(limit) } : {}),
		};
		return c.json((await logRead(pool, options)).map(wireEvent));
	});

	// ── Authority ─────────────────────────────────────────────────────────────

	app.post("/capabilities", async (c) => {
		const body = (await c.req.json()) as Parameters<typeof grant>[1];
		return c.json(await grant(pool, body), 201);
	});

	app.get("/capabilities", async (c) => c.json(await listCapabilities(pool)));

	app.get("/capabilities/:id", async (c) => {
		const capability = await getCapability(pool, c.req.param("id"));
		return capability ? c.json(capability) : c.json({ error: "not found" }, 404);
	});

	/**
	 * The authority decision. Every effect a node performs passes through here,
	 * on every use, and nothing is cached on either side.
	 *
	 * A denial is recorded by `authorize` before this responds, so the log has it
	 * whether or not the node does anything with the answer.
	 */
	app.post("/capabilities/authorize", async (c) => {
		const body = (await c.req.json()) as {
			capabilityId: string;
			holder: string;
			operation: Operation;
			target: string;
		};
		const request: AuthorizationRequest = body;
		return c.json(await authorize(pool, request));
	});

	app.post("/capabilities/:id/revoke", async (c) => {
		const body = (await c.req.json()) as { actor: string; reason: string };
		const revoked = await revoke(pool, c.req.param("id"), body.actor, body.reason);
		return c.json({ revoked });
	});

	// ── Leases ────────────────────────────────────────────────────────────────

	/**
	 * Take the lease on a worker. `03-RUNTIME` §4.
	 *
	 * Granted unconditionally, on purpose. The control plane cannot tell a dead
	 * node from a partitioned one, and asking would mean guessing. It hands out
	 * the next epoch and lets the log settle who was right: the previous holder
	 * finds out on its next write.
	 */
	app.post("/leases", async (c) => {
		const body = (await c.req.json()) as { worker: string; node: string; ttlMs?: number };
		const lease = await acquireLease(pool, body.worker, body.node, body.ttlMs ?? 30_000);
		return c.json(wireLease(lease), 201);
	});

	app.get("/leases/:worker", async (c) => {
		const lease = await getLease(pool, c.req.param("worker"));
		return lease === null ? c.json({ held: false }, 404) : c.json(wireLease(lease));
	});

	app.post("/leases/:worker/renew", async (c) => {
		const body = (await c.req.json()) as { node: string; epoch: string; ttlMs?: number };
		const held = await getLease(pool, c.req.param("worker"));
		if (held === null || held.epoch !== BigInt(body.epoch)) {
			// Renewing a lease you no longer hold is the same situation as writing
			// at a stale epoch, and gets the same answer, so a caller has one thing
			// to handle rather than two.
			return c.json({ fenced: true, detail: "this lease is no longer held" }, 409);
		}
		return c.json(wireLease(await renewLease(pool, held, body.ttlMs ?? 30_000)));
	});

	app.post("/leases/:worker/release", async (c) => {
		const body = (await c.req.json()) as { reason: string };
		const held = await getLease(pool, c.req.param("worker"));
		if (held !== null) await releaseLease(pool, held, body.reason);
		return c.json({ released: held !== null });
	});

	// ── The model ─────────────────────────────────────────────────────────────

	/**
	 * A model call is an effect, so it takes the same road as any other:
	 * authorised, metered, and recorded. It runs here rather than on the node
	 * because the subscription is a credential and workers never hold
	 * credentials (`05-CAPABILITIES` §5), and because the worker path must be
	 * incapable of spawning a process (`ADR-003` §3). See `ADR-009`.
	 */
	app.post("/model/invoke", async (c) => {
		const body = (await c.req.json()) as {
			capabilityId: string;
			holder: string;
			modelClass: ModelClass;
			prompt: string;
		};

		const authorization = await authorize(pool, {
			capabilityId: body.capabilityId,
			holder: body.holder,
			operation: "invoke",
			// The class is the target: a capability for `fast` does not reach
			// `reasoning`, and containment for a model is equality (`scope.ts`).
			target: body.modelClass,
		});

		if (!authorization.granted) {
			// Already in the log, written by authorize. Returned as an ordinary
			// answer rather than an error because a denial is an outcome.
			return c.json(authorization, 403);
		}

		const { granted, reserved, settled } = authorization.capability.limits;
		const available = granted - reserved - settled;

		// Reserve the smaller of a typical call and everything that is left, so a
		// nearly empty budget holds what it actually has rather than going
		// negative and looking like an overspend that never happened.
		const held = Math.min(callEstimate(), available);

		await reserve(pool, body.capabilityId, body.holder, held);

		try {
			const result = await invoke({
				modelClass: body.modelClass,
				prompt: body.prompt,
				budget: available,
			});
			await settle(pool, body.capabilityId, body.holder, result.cost, held);
			return c.json({ granted: true, ...result });
		} catch (error: unknown) {
			// The call did not produce a billable answer, so nothing is owed, but
			// the reservation still has to come back. Settling zero against the
			// held amount does both, and leaves the attempt visible in the log.
			await settle(pool, body.capabilityId, body.holder, 0, held);
			if (error instanceof ModelCallRefused) {
				return c.json({ granted: true, refused: error.message }, 502);
			}
			throw error;
		}
	});

	/**
	 * Objectives, so a daemon can find work rather than being handed it.
	 *
	 * `?state=admitted` is the query a node actually makes: everything stated,
	 * admitted, and not yet finished or being worked on by somebody else.
	 */
	app.get("/objectives", async (c) => {
		const { state } = c.req.query();
		const objectives = await listObjectives(pool);
		return c.json(
			state === undefined ? objectives : objectives.filter((o) => o.state === state),
		);
	});

	/**
	 * Claim an objective. Scheduling, not judgment.
	 *
	 * Moves it from admitted to active, so the next node to look for work does
	 * not find it and start again. Refused if somebody already has it, which is
	 * the answer rather than an error: two nodes asking at once is normal and one
	 * of them has to lose.
	 */
	app.post("/objectives/:id/take", async (c) => {
		const body = (await c.req.json()) as { worker: string; node: string; epoch?: string };
		const id = c.req.param("id");
		const objective = await getObjective(pool, id);

		if (objective === null) return c.json({ error: "not found" }, 404);
		if (objective.state !== "admitted") {
			return c.json({ taken: false, state: objective.state }, 409);
		}

		await takeObjective(pool, id, body.worker, body.node, BigInt(body.epoch ?? "0"));
		return c.json({ taken: true });
	});

	app.get("/objectives/:id", async (c) => {
		const objective = await getObjective(pool, c.req.param("id"));
		return objective ? c.json(objective) : c.json({ error: "not found" }, 404);
	});

	// ── Judgment ──────────────────────────────────────────────────────────────

	/**
	 * Record a verdict, for a worker that holds the authority to judge.
	 *
	 * The authority check is the whole point of this route existing: an evaluator
	 * is a worker like any other (`09-EVALUATION` §4), so it reaches judgment the
	 * same way it reaches a disk, and a worker that executed the objective is
	 * refused here exactly as it is refused everywhere else.
	 */
	app.post("/objectives/evaluate", async (c) => {
		const body = (await c.req.json()) as {
			capabilityId: string;
			holder: string;
			objective: string;
			contractHash: string;
			verdicts: Verdict[];
		};

		const authorization = await authorize(pool, {
			capabilityId: body.capabilityId,
			holder: body.holder,
			operation: "evaluate",
			target: body.objective,
		});
		if (!authorization.granted) return c.json(authorization, 403);

		const evaluation = await recordEvaluation(
			pool,
			body.objective,
			body.holder,
			body.contractHash,
			body.verdicts,
		);
		return c.json({
			rollup: evaluation.rollup,
			outcome: evaluation.outcome,
			remaining: evaluation.remaining,
		});
	});

	// ── The repository ────────────────────────────────────────────────────────

	/**
	 * A commit, made by the broker. `05-CAPABILITIES` §5.
	 *
	 * The worker sends what it wants written and gets back a commit hash. It
	 * never sees a token, a key, an agent socket, or a clone, and the node
	 * process is started without the credential in its environment, so this is
	 * enforced by absence rather than by restraint.
	 */
	app.post("/repository/effect", async (c) => {
		const body = (await c.req.json()) as {
			capabilityId: string;
			holder: string;
			repository: string;
			branch: string;
			path: string;
			content: string;
			intentId: string;
		};

		const authorization = await authorize(pool, {
			capabilityId: body.capabilityId,
			holder: body.holder,
			operation: "commit",
			// The repository is the target, and containment for a repository is
			// equality: a capability for the sandbox does not reach anything else.
			target: body.repository,
		});
		if (!authorization.granted) return c.json(authorization, 403);

		try {
			return c.json(await performRepositoryEffect(body));
		} catch (error: unknown) {
			if (error instanceof RepositoryRefused) {
				return c.json({ refused: error.message }, 502);
			}
			throw error;
		}
	});

	/**
	 * Ask the remote whether an effect landed, for recovery.
	 *
	 * Not authorised against a capability, because it changes nothing: it is a
	 * question about the world, asked during recovery, and refusing to answer it
	 * would leave a crash unresolvable. It reads the remote and nothing else.
	 */
	app.get("/repository/reconcile", async (c) => {
		const { repository, branch, intentId } = c.req.query();
		if (!repository || !branch || !intentId) {
			return c.json({ error: "repository, branch and intentId are all required" }, 400);
		}
		try {
			const commit = await reconcile(repository, branch, intentId);
			return c.json({ landed: commit !== null, commit });
		} catch (error: unknown) {
			// Could not ask is not the same answer as did not happen. P8.
			return c.json({ unknown: true, detail: String(error) }, 503);
		}
	});

	return app;
}
