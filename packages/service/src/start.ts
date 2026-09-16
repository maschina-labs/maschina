/** Starts a service's HTTP listener and wires it into graceful shutdown. */

import { serve } from "@hono/node-server";
import { type Logger, onShutdown, type ShutdownStep } from "@maschina/telemetry";
import type { Hono } from "hono";

export type StartOptions = {
	// biome-ignore lint/suspicious/noExplicitAny: any Hono app, whatever its environment type
	app: Hono<any>;
	port: number;
	logger: Logger;
	/** Run after the listener stops accepting connections, in order. */
	shutdown?: ShutdownStep[];
};

export function startServer({ app, port, logger, shutdown = [] }: StartOptions): void {
	const server = serve({ fetch: app.fetch, port }, (info) => {
		logger.info({ port: info.port }, "listening");
	});

	onShutdown(
		[
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
}
