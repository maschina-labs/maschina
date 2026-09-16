/**
 * Liveness and readiness. `/health` says the process is up. `/ready` says it can do its job, and
 * returns 503 when a dependency is down, so a load balancer stops sending it work.
 */

import type { HealthResponse } from "@maschina/contracts";
import type { Clock } from "@maschina/core";
import { systemClock } from "@maschina/core";
import type { Hono } from "hono";
import type { ServiceEnv } from "./app.ts";

export type ReadinessCheck = {
	name: string;
	check: () => Promise<boolean>;
};

export type HealthOptions = {
	service: string;
	version: string;
	checks?: ReadinessCheck[];
	clock?: Clock;
	/** How long a single readiness check may take before it counts as failed. */
	checkTimeoutMs?: number;
};

export function registerHealth(app: Hono<ServiceEnv>, options: HealthOptions): void {
	const { service, version, checks = [], clock = systemClock, checkTimeoutMs = 2_000 } = options;

	const body = (status: HealthResponse["status"]): HealthResponse => ({
		status,
		service,
		version,
		time: clock.now().toISOString(),
	});

	app.get("/health", (c) => c.json(body("ok")));

	app.get("/ready", async (c) => {
		const results = await Promise.all(
			checks.map(async ({ name, check }) => ({
				name,
				ok: await withTimeout(check, checkTimeoutMs),
			})),
		);
		const failing = results.filter((r) => !r.ok).map((r) => r.name);
		if (failing.length > 0) {
			c.get("logger").warn({ failing }, "not ready");
			return c.json({ ...body("degraded"), failing }, 503);
		}
		return c.json(body("ok"));
	});
}

async function withTimeout(check: () => Promise<boolean>, ms: number): Promise<boolean> {
	let timer: NodeJS.Timeout | undefined;
	try {
		return await Promise.race([
			check().catch(() => false),
			new Promise<boolean>((resolve) => {
				timer = setTimeout(() => resolve(false), ms);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}
