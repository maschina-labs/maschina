import { describe, expect, it, vi } from "vitest";
import { claude } from "./claude.ts";

const request = {
	model: "claude-sonnet-5",
	system: "You manage machines.",
	messages: [{ role: "user" as const, content: "hi" }],
	tools: [
		{ name: "a", description: "first", input_schema: { type: "object" } },
		{ name: "b", description: "last", input_schema: { type: "object" } },
	],
	maxTokens: 500,
};

const answering = (status: number, body: unknown) =>
	vi.fn(
		async (_url: string | URL | Request, _init?: RequestInit) =>
			new Response(JSON.stringify(body), { status }),
	);

describe("asking Claude", () => {
	it("sends the key, caches the prompt and tools, and reads the answer", async () => {
		const fetch = answering(200, {
			content: [{ type: "text", text: "hello" }],
			stop_reason: "end_turn",
			usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 900 },
		});
		const reply = await claude("sk-ant-k", { fetch, baseUrl: "https://example.test" })(request);
		expect(reply).toEqual({
			content: [{ type: "text", text: "hello" }],
			stopReason: "end_turn",
			usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 900, cacheWriteTokens: 0 },
		});
		const [url, init] = fetch.mock.calls[0] ?? [];
		expect(url).toBe("https://example.test/v1/messages");
		expect(init?.headers).toMatchObject({
			"x-api-key": "sk-ant-k",
			"anthropic-version": "2023-06-01",
		});
		const sent = JSON.parse(String(init?.body));
		expect(sent.system[0].cache_control).toEqual({ type: "ephemeral" });
		expect(sent.tools[0].cache_control).toBeUndefined();
		expect(sent.tools[1].cache_control).toEqual({ type: "ephemeral" });
		expect(sent).toMatchObject({
			model: "claude-sonnet-5",
			max_tokens: 500,
			thinking: { type: "adaptive" },
			output_config: { effort: "medium" },
		});
	});

	it("asks an older model for no effort, which it would refuse", async () => {
		const fetch = answering(200, {});
		await claude("k", { fetch })({ ...request, model: "claude-haiku-4-5-20251001" });
		const sent = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
		expect(sent.thinking).toBeUndefined();
		expect(sent.output_config).toBeUndefined();
	});

	it("passes the effort asked for", async () => {
		const fetch = answering(200, {});
		await claude("k", { fetch })({ ...request, model: "claude-opus-5-5", effort: "high" });
		expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).output_config).toEqual({
			effort: "high",
		});
	});

	it("sends no tools field when there are none", async () => {
		const fetch = answering(200, {});
		const reply = await claude("k", { fetch })({ ...request, tools: [] });
		expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).tools).toBeUndefined();
		expect(reply).toEqual({
			content: [],
			stopReason: "unknown",
			usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
		});
	});

	it.each([
		[401, {}, "forbidden", "replace it in settings"],
		[
			400,
			{ error: { message: "Your credit balance is too low" } },
			"limit_exceeded",
			"credit has run out",
		],
		[429, {}, "limit_exceeded", "try again shortly"],
		[529, { error: { message: "Overloaded" } }, "unavailable", "529: Overloaded"],
		[500, {}, "unavailable", "Claude answered 500"],
	])("turns a %i into words an owner can act on", async (status, body, code, words) => {
		const failing = claude("k", { fetch: answering(status, body) })(request);
		await expect(failing).rejects.toMatchObject({ code });
		await expect(claude("k", { fetch: answering(status, body) })(request)).rejects.toThrow(words);
	});

	it("says so when Claude cannot be reached", async () => {
		const down = vi.fn(async () => {
			throw new TypeError("fetch failed");
		});
		await expect(claude("k", { fetch: down })(request)).rejects.toThrow("could not be reached");
	});
});
