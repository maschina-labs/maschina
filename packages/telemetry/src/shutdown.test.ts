import { Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.ts";
import { onShutdown, runShutdown } from "./shutdown.ts";

const silent = createLogger(
	{ service: "test" },
	new Writable({
		write(_c, _e, done) {
			done();
		},
	}),
);

describe("runShutdown", () => {
	it("runs every step in order", async () => {
		const order: string[] = [];
		const clean = await runShutdown(
			[
				{ name: "a", run: () => void order.push("a") },
				{ name: "b", run: async () => void order.push("b") },
			],
			silent,
		);
		expect(order).toEqual(["a", "b"]);
		expect(clean).toBe(true);
	});

	it("keeps going after a failed step, and reports it", async () => {
		const order: string[] = [];
		const clean = await runShutdown(
			[
				{
					name: "a",
					run: () => {
						throw new Error("boom");
					},
				},
				{ name: "b", run: () => void order.push("b") },
			],
			silent,
		);
		expect(order).toEqual(["b"]);
		expect(clean).toBe(false);
	});
});

describe("onShutdown", () => {
	const removers: (() => void)[] = [];
	afterEach(() => {
		for (const remove of removers.splice(0)) remove();
		vi.useRealTimers();
	});

	it("exits 0 after a clean shutdown, once, however many signals arrive", async () => {
		const exit = vi.fn();
		const step = vi.fn();
		removers.push(
			onShutdown([{ name: "close", run: step }], {
				logger: silent,
				signals: ["SIGUSR2"],
				exit,
			}),
		);
		process.emit("SIGUSR2");
		process.emit("SIGUSR2");
		await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
		expect(step).toHaveBeenCalledTimes(1);
	});

	it("exits 1 when a step fails", async () => {
		const exit = vi.fn();
		removers.push(
			onShutdown(
				[
					{
						name: "close",
						run: () => {
							throw new Error("boom");
						},
					},
				],
				{ logger: silent, signals: ["SIGUSR2"], exit },
			),
		);
		process.emit("SIGUSR2");
		await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
	});

	it("exits 1 when shutdown takes too long", async () => {
		vi.useFakeTimers();
		const exit = vi.fn();
		removers.push(
			onShutdown([{ name: "hang", run: () => new Promise(() => {}) }], {
				logger: silent,
				signals: ["SIGUSR2"],
				timeoutMs: 1_000,
				exit,
			}),
		);
		process.emit("SIGUSR2");
		await vi.advanceTimersByTimeAsync(1_001);
		expect(exit).toHaveBeenCalledWith(1);
	});

	it("stops listening when removed", () => {
		const before = process.listenerCount("SIGUSR2");
		const remove = onShutdown([], { logger: silent, signals: ["SIGUSR2"], exit: vi.fn() });
		expect(process.listenerCount("SIGUSR2")).toBe(before + 1);
		remove();
		expect(process.listenerCount("SIGUSR2")).toBe(before);
	});
});
