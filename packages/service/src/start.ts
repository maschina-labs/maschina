/** Starts a service's HTTP listener and wires it into graceful shutdown. */

import { serve } from "@hono/node-server";
import {
	type Logger,
	onShutdown,
	type ShutdownStep,
	startStatusHeartbeat,
} from "@maschina/telemetry";
import type { Hono } from "hono";

/** Often enough that a status page with a 1 to 3 minute grace notices a stall in good time, not so often as to matter. */
const HEARTBEAT_EVERY_MS = 60_000;

export type StartOptions = {
	// biome-ignore lint/suspicious/noExplicitAny: any Hono app, whatever its environment type
	app: Hono<any>;
	port: number;
	logger: Logger;
	/** Run after the listener stops accepting connections, in order. */
	shutdown?: ShutdownStep[];
	/** Where to tell the status page this service is up, while its own `/ready` says it can do its job. */
	statusHeartbeatUrl?: string | undefined;
};

export function startServer({
	app,
	port,
	logger,
	shutdown = [],
	statusHeartbeatUrl,
}: StartOptions) {
	const server = serve({ fetch: app.fetch, port }, (info) => {
		logger.info({ port: info.port }, "listening");
	});

	// The service asks itself whether it is ready, in-process: no request leaves the machine to find out.
	const stopHeartbeat = startStatusHeartbeat({
		url: statusHeartbeatUrl,
		intervalMs: HEARTBEAT_EVERY_MS,
		ready: async () => (await app.request("/ready")).ok,
		logger,
	});

	onShutdown(
		[
			{ name: "status heartbeat", run: async () => stopHeartbeat() },
			{
				name: "http",
				run: () =>
					new Promise<void>((resolve, reject) => {
						server.close((error) => (error ? reject(error) : resolve()));
					}),
			},
			...shutdown,
		],
		{ logger },
	);
	return server;
}
