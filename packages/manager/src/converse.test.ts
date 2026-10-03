import { describe, expect, it, vi } from "vitest";
import type { Claude, ClaudeReply } from "./claude.ts";
import { converse, type Tool } from "./converse.ts";
import { costOf } from "./cost.ts";

const usage = { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 };
const say = (text: string): ClaudeReply => ({
	content: [{ type: "text", text }],
	stopReason: "end_turn",
	usage,
});
const use = (name: string, input: Record<string, unknown> = {}, id = "t1"): ClaudeReply => ({
	content: [{ type: "tool_use", id, name, input }],
	stopReason: "tool_use",
	usage,
});

const scripted = (...replies: ClaudeReply[]) =>
	vi.fn<Claude>(async () => replies.shift() ?? say("done"));

const machines: Tool = {
	name: "list_machines",
	description: "Your machines",
	input_schema: { type: "object", properties: {} },
	run: vi.fn(async () => [{ name: "Range Finder", state: "running" }]),
};

const base = { model: "claude-sonnet-5", system: "s", tools: [machines] };

describe("a turn of conversation", () => {
	it("answers straight away when no tool is needed", async () => {
		const turn = await converse({
			...base,
			claude: scripted(say("Hello.")),
			messages: [{ role: "user", content: "hi" }],
		});
		expect(turn.reply).toBe("Hello.");
		expect(turn.calls).toEqual([]);
		expect(turn.costUsd).toBe(costOf("claude-sonnet-5", usage));
	});

	it("uses a tool, hands Claude the result, then answers", async () => {
		const claude = scripted(use("list_machines"), say("Range Finder is running."));
		const turn = await converse({
			...base,
			claude,
			messages: [{ role: "user", content: "how are they" }],
		});
		expect(turn.reply).toBe("Range Finder is running.");
		expect(turn.calls).toEqual([{ name: "list_machines", input: {}, ok: true }]);
		const second = claude.mock.calls[1]?.[0];
		expect(second?.messages.at(-1)).toEqual({
			role: "user",
			content: [
				{
					type: "tool_result",
					tool_use_id: "t1",
					content: '[{"name":"Range Finder","state":"running"}]',
				},
			],
		});
		// Both steps are paid for.
		expect(turn.usage.inputTokens).toBe(2000);
		expect(second?.tools).toEqual([
			{
				name: "list_machines",
				description: "Your machines",
				input_schema: { type: "object", properties: {} },
			},
		]);
	});

	it("tells Claude when a tool fails or does not exist, and carries on", async () => {
		const broken: Tool = {
			...machines,
			name: "broken",
			run: async () => Promise.reject(new Error("the record is down")),
		};
		const claude = scripted(
			use("broken", {}, "a"),
			use("made_up", {}, "b"),
			say("Sorry, I could not look."),
		);
		const turn = await converse({
			...base,
			tools: [broken],
			claude,
			messages: [{ role: "user", content: "?" }],
		});
		expect(turn.reply).toBe("Sorry, I could not look.");
		expect(turn.calls.map((call) => call.ok)).toEqual([false, false]);
		const results = claude.mock.calls[2]?.[0].messages.at(-1)?.content;
		expect(results).toEqual([
			{
				type: "tool_result",
				tool_use_id: "b",
				content: "there is no tool called made_up",
				is_error: true,
			},
		]);
	});

	it("cuts a huge tool answer so it cannot eat the credit", async () => {
		const huge: Tool = { ...machines, run: async () => "x".repeat(50_000) };
		const claude = scripted(use("list_machines"), say("ok"));
		await converse({ ...base, tools: [huge], claude, messages: [{ role: "user", content: "?" }] });
		const sent = claude.mock.calls[1]?.[0].messages.at(-1)?.content as { content: string }[];
		expect(sent[0]?.content.length).toBeLessThan(25_000);
		expect(sent[0]?.content).toContain("[cut:");
	});

	it("stops a model going around in circles, and says so", async () => {
		const claude = vi.fn<Claude>(async () => use("list_machines"));
		const turn = await converse({ ...base, claude, messages: [{ role: "user", content: "loop" }] });
		expect(claude).toHaveBeenCalledTimes(8);
		expect(turn.reply).toContain("went around in circles");
	});
});

describe("what it cost", () => {
	it("prices cached reads at a tenth and writes at a quarter more", () => {
		expect(
			costOf("claude-sonnet-5", {
				inputTokens: 1_000_000,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			}),
		).toBe(3);
		expect(
			costOf("claude-sonnet-5", {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 1_000_000,
				cacheWriteTokens: 0,
			}),
		).toBeCloseTo(0.3);
		expect(
			costOf("claude-sonnet-5", {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 1_000_000,
			}),
		).toBeCloseTo(3.75);
		expect(
			costOf("claude-sonnet-5", {
				inputTokens: 0,
				outputTokens: 1_000_000,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			}),
		).toBe(15);
	});

	it("prices a model it does not know as the dearest, never cheaper than it was", () => {
		expect(
			costOf("claude-future", {
				inputTokens: 1_000_000,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
			}),
		).toBe(15);
	});
});
