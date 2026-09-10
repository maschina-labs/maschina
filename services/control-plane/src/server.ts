/**
 * Runs the control plane.
 *
 * Binds to loopback only. Nothing about Stage 0 should be reachable from
 * another machine, and a service that binds 0.0.0.0 by default is one
 * misconfigured firewall away from being reachable by everyone.
 */

import { serve } from "@hono/node-server";
import { appPool } from "@maschina/db";
import { createApp } from "./app.ts";

const port = Number(process.env.MASCHINA_CONTROL_PLANE_PORT ?? 8787);
const pool = appPool();

const server = serve({ fetch: createApp(pool).fetch, port, hostname: "127.0.0.1" }, (info) => {
	console.log(`control plane listening on http://127.0.0.1:${info.port}`);
});

// Without this the port being taken is an unhandled 'error' event: a stack trace
// through node:net that says nothing about what to do, and under `turbo dev` it
// scrolls away behind the teardown message, leaving only "1 task shutting
// down..." on screen. The failure is fine. Being unreadable is not.
server.on("error", (error: NodeJS.ErrnoException) => {
	if (error.code === "EADDRINUSE") {
		console.error(
			[
				``,
				`Port ${port} is already taken, so the control plane did not start.`,
				`Something else is still listening on it, usually a control plane from`,
				`an earlier run that was never stopped.`,
				``,
				`  See what has it:  lsof -nP -iTCP:${port} -sTCP:LISTEN`,
				`  Stop it:          kill <pid>`,
				`  Or use another:   MASCHINA_CONTROL_PLANE_PORT=8788 pnpm dev`,
				``,
			].join("\n"),
		);
		process.exit(1);
	}
	throw error;
});

const shutdown = async (signal: string): Promise<void> => {
	console.log(`\n${signal}. Closing the pool.`);
	await pool.end();
	process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
