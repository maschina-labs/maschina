import { Writable } from "node:stream";
import { createLogger } from "@maschina/telemetry";

/** A logger that keeps what it writes, so tests can assert on logs. */
export function memoryLogger() {
	const lines: Record<string, unknown>[] = [];
	const logger = createLogger(
		{ service: "test", level: "trace" },
		new Writable({
			write(chunk, _encoding, done) {
				lines.push(JSON.parse(chunk.toString()));
				done();
			},
		}),
	);
	return { logger, lines };
}
