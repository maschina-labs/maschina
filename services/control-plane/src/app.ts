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
	FilesystemOperation,
	NewEvent,
	ReadOptions,
} from "@maschina/core";
import {
	authorize,
	getCapability,
	grant,
	listCapabilities,
	append as logAppend,
	read as logRead,
	revoke,
} from "@maschina/db";
import { Hono } from "hono";
import type { Pool } from "pg";

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

export function createApp(pool: Pool): Hono {
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

		return c.json(wireEvent(await logAppend(pool, event)), 201);
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
			operation: FilesystemOperation;
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

	return app;
}
