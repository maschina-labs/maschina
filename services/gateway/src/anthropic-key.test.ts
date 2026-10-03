import { describe, expect, it, vi } from "vitest";
import { checkAnthropicKey } from "./anthropic-key.ts";

const answer = (status: number) => vi.fn(async () => new Response("{}", { status }));

describe("checking an AI key with Anthropic", () => {
	it("accepts a key Anthropic accepts, without spending anything", async () => {
		const fetch = answer(200);
		await checkAnthropicKey("sk-ant-test", { fetch, baseUrl: "https://example.test" });
		expect(fetch).toHaveBeenCalledWith(
			"https://example.test/v1/models?limit=1",
			expect.objectContaining({
				headers: { "x-api-key": "sk-ant-test", "anthropic-version": "2023-06-01" },
			}),
		);
	});

	it("says plainly when the key is refused", async () => {
		await expect(checkAnthropicKey("sk-ant-x", { fetch: answer(401) })).rejects.toThrow(
			"Anthropic did not accept that key",
		);
		await expect(checkAnthropicKey("sk-ant-x", { fetch: answer(403) })).rejects.toMatchObject({
			code: "invalid_input",
		});
	});

	it("tells a refused key apart from Anthropic being down", async () => {
		await expect(checkAnthropicKey("sk-ant-x", { fetch: answer(529) })).rejects.toMatchObject({
			code: "unavailable",
		});
		const unreachable = vi.fn(async () => {
			throw new TypeError("fetch failed");
		});
		await expect(checkAnthropicKey("sk-ant-x", { fetch: unreachable })).rejects.toMatchObject({
			code: "unavailable",
		});
	});
});
