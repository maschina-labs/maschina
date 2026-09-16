import { MaschinaError } from "@maschina/core";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";
import { createServiceApp } from "./app.ts";
import { memoryLogger } from "./test-logger.ts";

function setup(options: { maxBodyBytes?: number; timeoutMs?: number } = {}) {
	const { logger, lines } = memoryLogger();
	const reporter = { enabled: true, capture: vi.fn(), flush: vi.fn(async () => {}) };
	const app = createServiceApp({ service: "test", logger, reporter, ...options });
	return { app, lines, reporter };
}

describe("createServiceApp", () => {
	it("gives every response a request id and security headers", async () => {
		const { app } = setup();
		app.get("/x", (c) => c.json({ id: c.get("requestId") }));
		const res = await app.request("/x");
		const id = res.headers.get("x-request-id");
		expect(id).toMatch(/^[0-9a-f-]{36}$/);
		expect(await res.json()).toEqual({ id });
		expect(res.headers.get("x-content-type-options")).toBe("nosniff");
		expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
	});

	it("keeps a safe incoming request id and replaces an unsafe one", async () => {
		const { app } = setup();
		app.get("/x", (c) => c.text("ok"));
		const kept = await app.request("/x", { headers: { "x-request-id": "abc-12345678" } });
		expect(kept.headers.get("x-request-id")).toBe("abc-12345678");
		const replaced = await app.request("/x", {
			headers: { "x-request-id": "<script>alert(1)</script>" },
		});
		expect(replaced.headers.get("x-request-id")).not.toContain("<");
	});

	it("logs every request with its status and duration", async () => {
		const { app, lines } = setup();
		app.get("/x", (c) => c.text("ok"));
		await app.request("/x");
		expect(lines.find((l) => l["msg"] === "request")).toMatchObject({
			method: "GET",
			path: "/x",
			status: 200,
			requestId: expect.any(String),
		});
	});

	it("answers unknown routes with a structured 404", async () => {
		const { app } = setup();
		const res = await app.request("/nope");
		expect(res.status).toBe(404);
		expect(await res.json()).toMatchObject({
			error: { code: "not_found", requestId: expect.any(String) },
		});
	});

	it("turns a MaschinaError into its status and code", async () => {
		const { app, reporter } = setup();
		app.get("/x", () => {
			throw new MaschinaError("forbidden", "not your machine");
		});
		const res = await app.request("/x");
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({
			error: { code: "forbidden", message: "not your machine" },
		});
		expect(reporter.capture).not.toHaveBeenCalled();
	});

	it("reports server-side MaschinaErrors", async () => {
		const { app, reporter } = setup();
		app.get("/x", () => {
			throw new MaschinaError("unavailable", "database down");
		});
		expect((await app.request("/x")).status).toBe(503);
		expect(reporter.capture).toHaveBeenCalledOnce();
	});

	it("hides unexpected errors from the caller but logs and reports them", async () => {
		const { app, lines, reporter } = setup();
		app.get("/x", () => {
			throw new Error("connection string postgres://secret@host");
		});
		const res = await app.request("/x");
		expect(res.status).toBe(500);
		const body = await res.text();
		expect(body).not.toContain("secret");
		expect(JSON.parse(body)).toMatchObject({
			error: { code: "internal", message: "something went wrong" },
		});
		expect(lines.some((l) => l["msg"] === "unhandled error")).toBe(true);
		expect(reporter.capture).toHaveBeenCalledOnce();
	});

	it.each([
		[400, "invalid_input"],
		[401, "unauthenticated"],
		[403, "forbidden"],
		[404, "not_found"],
		[429, "limit_exceeded"],
		[502, "unavailable"],
	] as const)("maps an HTTP %s to %s", async (status, code) => {
		const { app } = setup();
		app.get("/x", () => {
			throw new HTTPException(status, { message: "nope" });
		});
		const res = await app.request("/x");
		expect(res.status).toBe(status);
		expect(await res.json()).toMatchObject({ error: { code } });
	});

	it("refuses bodies over the limit", async () => {
		const { app } = setup({ maxBodyBytes: 10 });
		app.post("/x", async (c) => c.text(await c.req.text()));
		const res = await app.request("/x", {
			method: "POST",
			body: "x".repeat(11),
			headers: { "content-length": "11" },
		});
		expect(res.status).toBe(413);
	});

	it("cuts off slow requests", async () => {
		const { app } = setup({ timeoutMs: 20 });
		app.get("/slow", async (c) => {
			await new Promise((resolve) => setTimeout(resolve, 200));
			return c.text("late");
		});
		const res = await app.request("/slow");
		expect(res.status).toBe(504);
		expect(await res.json()).toMatchObject({ error: { code: "unavailable" } });
	});
});
