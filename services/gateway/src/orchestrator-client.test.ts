import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import { orchestratorClient } from "./orchestrator-client.ts";

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const everything = { withdrawalId: newId<"withdrawal">(), machineId: newId<"machine">() };
const refused = {
	status: "refused",
	withdrawalId: everything.withdrawalId,
	rule: "unknown_machine",
	reason: "no machine by that id has an owner",
};

describe("the gateway asking the orchestrator for an owner", () => {
	it("asks the owner route with the gateway's token, and reads the answer", async () => {
		const fetchFn = vi.fn(async () => json(refused));
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: fetchFn,
		});

		expect(await client.withdrawEverything(everything)).toEqual(refused);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
		expect(String(url)).toBe("http://orchestrator:4100/owner/v1/withdraw-everything");
		expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
	});

	it("passes a conflict on in the orchestrator's own words, so the owner is told to pause first", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () =>
				json(
					{ error: { code: "conflict", message: "this machine is running, so pause or stop it" } },
					409,
				),
		});
		await expect(client.withdrawEverything(everything)).rejects.toMatchObject({
			code: "conflict",
			message: expect.stringContaining("pause or stop"),
		});
	});

	it.each([
		[404, "not_found"],
		[400, "invalid_input"],
		[503, "unavailable"],
		[500, "unavailable"],
	])("reads a %i as %s", async (status, code) => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => json({}, status),
		});
		await expect(client.withdrawEverything(everything)).rejects.toMatchObject({ code });
	});

	it("says the orchestrator cannot be reached rather than inventing an outcome", async () => {
		const client = orchestratorClient({
			url: "http://orchestrator:4100",
			token: "tok",
			fetch: async () => {
				throw new Error("ECONNREFUSED");
			},
		});
		await expect(client.withdrawEverything(everything)).rejects.toMatchObject({
			code: "unavailable",
		});
	});
});
