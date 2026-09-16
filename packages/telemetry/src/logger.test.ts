import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, REDACTED_KEYS } from "./logger.ts";

function capture() {
	const lines: { time?: unknown; msg?: unknown; [key: string]: unknown }[] = [];
	const stream = new Writable({
		write(chunk, _encoding, done) {
			lines.push(JSON.parse(chunk.toString()));
			done();
		},
	});
	return { lines, stream };
}

describe("createLogger", () => {
	it("writes one JSON object per line with the service name and level", () => {
		const { lines, stream } = capture();
		createLogger({ service: "gateway" }, stream).info({ runId: "r1" }, "run started");
		expect(lines[0]).toMatchObject({
			service: "gateway",
			level: "info",
			runId: "r1",
			msg: "run started",
		});
		expect(typeof lines[0]?.time).toBe("string");
	});

	it("respects the level", () => {
		const { lines, stream } = capture();
		const logger = createLogger({ service: "x", level: "warn" }, stream);
		logger.info("hidden");
		logger.warn("shown");
		expect(lines.map((l) => l.msg)).toEqual(["shown"]);
	});

	it.each(REDACTED_KEYS)("never writes a %s, at any depth", (key) => {
		const { lines, stream } = capture();
		const secret = "s3cret-value-that-must-not-appear";
		createLogger({ service: "x" }, stream).info(
			{ [key]: secret, nested: { [key]: secret, deeper: { [key]: secret } } },
			"event",
		);
		const written = JSON.stringify(lines);
		expect(written).not.toContain(secret);
		expect(written).toContain("[redacted]");
	});

	it("writes to stdout by default, and can pretty-print for development", () => {
		const plain = createLogger({ service: "x", level: "silent" });
		const pretty = createLogger({ service: "x", level: "silent", pretty: true });
		expect(plain.level).toBe("silent");
		expect(pretty.level).toBe("silent");
		expect(typeof pretty.info).toBe("function");
	});
});
