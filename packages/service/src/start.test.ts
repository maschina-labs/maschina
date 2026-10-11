import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createServiceApp } from "./app.ts";
import { registerHealth } from "./health.ts";
import { startServer } from "./start.ts";
import { memoryLogger } from "./test-logger.ts";

const HEARTBEAT = "https://uptime.betterstack.com/api/v1/heartbeat/abc123";

const servers: { close(): void }[] = [];
afterEach(() => {
	for (const server of servers.splice(0)) server.close();
	vi.unstubAllGlobals();
});

function start(ready: boolean, statusHeartbeatUrl?: string) {
	const { logger } = memoryLogger();
	const app = createServiceApp({ service: "signer", logger });
	registerHealth(app, {
		service: "signer",
		version: "1",
		checks: [{ name: "database", check: async () => ready }],
	});
	const pings: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string | URL | Request) => {
			pings.push(String(input));
			return new Response("", { status: 200 });
		}),
	);
	const server = startServer({
		app,
		port: 0,
		logger,
		...(statusHeartbeatUrl === undefined ? {} : { statusHeartbeatUrl }),
	});
	servers.push(server);
	return { server, pings };
}

describe("starting a service", () => {
	it("listens, and gives back the server", async () => {
		const { server } = start(true);
		await vi.waitFor(() =>
			expect((server.address() as AddressInfo | null)?.port).toBeGreaterThan(0),
		);
	});

	it("reports to the status page while the service is ready, using its own readiness answer", async () => {
		const { pings } = start(true, HEARTBEAT);
		await vi.waitFor(() => expect(pings).toContain(HEARTBEAT));
	});

	it("stays silent while the service is not ready, so the status page sees the silence", async () => {
		const { pings } = start(false, HEARTBEAT);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(pings).toEqual([]);
	});

	it("does not report at all when no heartbeat address is set", async () => {
		const { pings } = start(true);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(pings).toEqual([]);
	});
});
