import { ManualClock } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { createServiceApp } from "./app.ts";
import { rateLimit } from "./rate-limit.ts";
import { memoryLogger } from "./test-logger.ts";

function app(clock: ManualClock, idleMs?: number) {
	const service = createServiceApp({ service: "gateway", logger: memoryLogger().logger });
	service.use(
		rateLimit({
			capacity: 2,
			refillPerSecond: 1,
			key: (c) => c.req.header("x-client") ?? "anonymous",
			clock,
			...(idleMs === undefined ? {} : { idleMs }),
		}),
	);
	service.get("/", (c) => c.text("ok"));
	return service;
}

const call = (service: ReturnType<typeof app>, client = "a") =>
	service.request("/", { headers: { "x-client": client } });

describe("rateLimit", () => {
	it("allows a burst, then refuses with a retry time", async () => {
		const service = app(new ManualClock());
		expect((await call(service)).status).toBe(200);
		const second = await call(service);
		expect(second.status).toBe(200);
		expect(second.headers.get("x-ratelimit-remaining")).toBe("0");
		const third = await call(service);
		expect(third.status).toBe(429);
		expect(third.headers.get("retry-after")).toBe("1");
		expect(await third.json()).toMatchObject({ error: { code: "limit_exceeded" } });
	});

	it("refills over time", async () => {
		const clock = new ManualClock();
		const service = app(clock);
		await call(service);
		await call(service);
		expect((await call(service)).status).toBe(429);
		clock.advance(1_000);
		expect((await call(service)).status).toBe(200);
	});

	it("never refills past capacity", async () => {
		const clock = new ManualClock();
		const service = app(clock);
		clock.advance(60_000);
		await call(service);
		await call(service);
		expect((await call(service)).status).toBe(429);
	});

	it("counts each client separately", async () => {
		const service = app(new ManualClock());
		await call(service, "a");
		await call(service, "a");
		expect((await call(service, "a")).status).toBe(429);
		expect((await call(service, "b")).status).toBe(200);
	});

	it("forgets idle clients", async () => {
		const clock = new ManualClock();
		const service = app(clock, 1_000);
		await call(service, "a");
		await call(service, "a");
		clock.advance(5_000);
		expect((await call(service, "b")).status).toBe(200);
		expect((await call(service, "a")).status).toBe(200);
	});
});
