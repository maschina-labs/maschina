import type { SignRequest } from "@maschina/contracts";
import { newId } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import { signerClient } from "./signer-client.ts";

const request = { proposalId: newId<"proposal">() } as unknown as SignRequest;
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the orchestrator's signer client", () => {
	it("asks with the token and reads the answer", async () => {
		const answer = { status: "signed", proposalId: request.proposalId, signature: "5".repeat(88) };
		const fetchFn = vi.fn(async () => json(answer));
		const client = signerClient({ url: "http://signer:4200", token: "tok", fetch: fetchFn });

		expect(await client.sign(request)).toEqual(answer);
		const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
		expect(String(url)).toBe("http://signer:4200/internal/v1/sign");
		expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok");
	});

	it("says unavailable when the signer is down or cannot be reached", async () => {
		const down = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({}, 503),
		});
		await expect(down.sign(request)).rejects.toMatchObject({ code: "unavailable" });

		const unreachable = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => {
				throw new TypeError("fetch failed");
			},
		});
		await expect(unreachable.sign(request)).rejects.toMatchObject({ code: "unavailable" });
	});

	it("says the proposal was invalid when the signer refused to read it", async () => {
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({}, 400),
		});
		await expect(client.sign(request)).rejects.toMatchObject({ code: "invalid_input" });
	});

	it("treats anything else as a fault", async () => {
		const client = signerClient({
			url: "http://signer:4200",
			token: "tok",
			fetch: async () => json({}, 500),
		});
		await expect(client.sign(request)).rejects.toMatchObject({ code: "internal" });
	});
});
