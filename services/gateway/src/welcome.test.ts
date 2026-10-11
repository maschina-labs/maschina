import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { ART } from "./welcome.ts";

const logger = createLogger({ service: "test", level: "silent" });

const app = () =>
	buildApp({
		version: "1.2.3",
		corsOrigins: ["http://localhost:3000"],
		logger,
		machines: {} as never,
		auth: { ownerOf: async () => undefined } as never,
		cookie: { secure: false },
	});

describe("the front door of the API", () => {
	it("welcomes anyone who asks for the root, as JSON, and says nothing is wrong, because nothing is", async () => {
		for (const path of ["/", "/v1", "/v1/"]) {
			const res = await app().request(path, { headers: { accept: "*/*" } });
			expect(res.status, path).toBe(200);
			expect(res.headers.get("content-type")).toContain("application/json");
			const body = (await res.json()) as Record<string, unknown>;
			expect(body["error"], path).toBeUndefined();
			expect(body).toMatchObject({
				name: "Maschina API",
				version: "1.2.3",
				status: "ok",
				website: "https://maschina.dev",
				openapi: "/openapi.json",
				health: "/v1/status",
			});
			expect(String(body["message"])).toMatch(/^Welcome to the Maschina API/);
		}
	});

	it("draws the name in ASCII, with the welcome under it, for a person looking in a browser or a terminal that asks for text", async () => {
		for (const accept of ["text/html,application/xhtml+xml,*/*;q=0.8", "text/plain"]) {
			const res = await app().request("/", { headers: { accept } });
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toContain("text/plain");
			const text = await res.text();
			for (const line of ART) expect(text).toContain(line);
			expect(text).toContain("Welcome to the Maschina API");
			expect(text).toContain("https://maschina.dev");
			expect(text).toContain("/openapi.json");
			expect(text).toContain("1.2.3");
		}
	});

	it("tells a cache that the answer depends on what was asked for", async () => {
		const res = await app().request("/");
		expect(res.headers.get("vary")?.toLowerCase()).toContain("accept");
	});

	it("keeps the art to a plain terminal: ASCII only, under 80 columns, no long dashes", () => {
		expect(ART.length).toBeGreaterThanOrEqual(5);
		for (const line of ART) {
			expect(line.length).toBeLessThanOrEqual(80);
			expect(line).toMatch(/^[\x20-\x7e]*$/);
		}
	});

	it("still answers a route that does not exist with the error it is, so a mistake in a path is never hidden", async () => {
		const res = await app().request("/v1/nope");
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: { code: string } };
		expect(body.error.code).toBe("not_found");
	});
});
