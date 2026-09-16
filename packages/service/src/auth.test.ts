import { describe, expect, it } from "vitest";
import { createServiceApp } from "./app.ts";
import { requireServiceToken } from "./auth.ts";
import { memoryLogger } from "./test-logger.ts";

const TOKEN = "t".repeat(40);

function app() {
	const service = createServiceApp({ service: "orchestrator", logger: memoryLogger().logger });
	service.use("/internal/*", requireServiceToken(TOKEN));
	service.get("/internal/work", (c) => c.json({ work: [] }));
	return service;
}

describe("requireServiceToken", () => {
	it("lets the right token through", async () => {
		const res = await app().request("/internal/work", {
			headers: { authorization: `Bearer ${TOKEN}` },
		});
		expect(res.status).toBe(200);
	});

	it.each([
		["no header", undefined],
		["wrong token", `Bearer ${"x".repeat(40)}`],
		["shorter token", "Bearer ttt"],
		["missing Bearer prefix", TOKEN],
		["empty bearer", "Bearer "],
	])("refuses %s", async (_label, authorization) => {
		const headers: Record<string, string> = authorization ? { authorization } : {};
		const res = await app().request("/internal/work", { headers });
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: "unauthenticated" } });
	});
});
