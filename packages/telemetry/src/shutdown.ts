/**
 * Graceful shutdown. On SIGTERM or SIGINT, stop taking new work, let what is running finish, close
 * connections, then exit. A daemon killed halfway through a trade is recovered by the record, but a
 * clean stop is still cheaper.
 */

import type { Logger } from "pino";

export type ShutdownStep = {
	name: string;
	run: () => Promise<void> | void;
};

export type ShutdownOptions = {
	logger: Logger;
	/** Give up and exit after this long, so a stuck step can't hang the process forever. */
	timeoutMs?: number;
	signals?: NodeJS.Signals[];
	exit?: (code: number) => void;
};

/** Runs every step in order, even if an earlier one fails, and reports whether all succeeded. */
export async function runShutdown(steps: ShutdownStep[], logger: Logger): Promise<boolean> {
	let clean = true;
	for (const step of steps) {
		try {
			await step.run();
			logger.info({ step: step.name }, "shutdown step finished");
		} catch (error) {
			clean = false;
			logger.error({ step: step.name, err: error }, "shutdown step failed");
		}
	}
	return clean;
}

export function onShutdown(steps: ShutdownStep[], options: ShutdownOptions): () => void {
	const {
		logger,
		timeoutMs = 10_000,
		signals = ["SIGTERM", "SIGINT"],
		/* v8 ignore next -- exiting the test runner is not something a test can do */
		exit = (code) => process.exit(code),
	} = options;
	let started = false;

	const handler = (signal: NodeJS.Signals) => {
		if (started) return;
		started = true;
		logger.info({ signal }, "shutting down");

		const timer = setTimeout(() => {
			logger.error({ timeoutMs }, "shutdown timed out, exiting");
			exit(1);
		}, timeoutMs);
		timer.unref();

		void runShutdown(steps, logger).then((clean) => {
			clearTimeout(timer);
			exit(clean ? 0 : 1);
		});
	};

	for (const signal of signals) process.on(signal, handler);
	return () => {
		for (const signal of signals) process.off(signal, handler);
	};
}
