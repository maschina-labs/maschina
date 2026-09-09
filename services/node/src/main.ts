/**
 * Run the node agent.
 *
 *   pnpm node:start
 *
 * Stays up, holds a lease, takes admitted objectives and runs them. Stop it with
 * ctrl-c and it gives the lease back rather than leaving one to expire.
 */

import { Daemon } from "./daemon.ts";
import { runObjective } from "./worker-loop.ts";

const daemon = new Daemon({
	controlPlaneUrl: process.env.MASCHINA_CONTROL_PLANE ?? "http://127.0.0.1:3000",
	node: process.env.MASCHINA_NODE ?? "node:local",
	// Named, not counted. Each one is a principal in the log and holds its own
	// lease, so three names means three objectives at once.
	workers: (process.env.MASCHINA_WORKERS ?? "worker:local").split(",").map((w) => w.trim()),
	run: runObjective,
	// Opt in. Holding somebody's machine awake is a thing to be asked for.
	// MASCHINA_STAY_AWAKE=1
	keepAwake: process.env.MASCHINA_STAY_AWAKE === "1",
});

/**
 * Stop once, however many signals arrive.
 *
 * Two ctrl-c presses used to mean two shutdowns racing each other, one of them
 * releasing a lease the other was still renewing.
 */
let stopping = false;
const shutdown = (signal: string) => {
	if (stopping) return;
	stopping = true;
	daemon
		.stop(`received ${signal}`)
		.catch((error: unknown) => console.error(error))
		.finally(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

await daemon.start();
