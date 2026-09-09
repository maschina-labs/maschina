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

serve({ fetch: createApp(pool).fetch, port, hostname: "127.0.0.1" }, (info) => {
	console.log(`control plane listening on http://127.0.0.1:${info.port}`);
});

const shutdown = async (signal: string): Promise<void> => {
	console.log(`\n${signal}. Closing the pool.`);
	await pool.end();
	process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
