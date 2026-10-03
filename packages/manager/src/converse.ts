/**
 * One turn of a conversation: Claude thinks, uses the tools it is given, and answers.
 *
 * The tools are the whole of what the manager can reach. It sees and does exactly what they allow and
 * nothing else, so what the manager may do is decided here, in code, not by what it is asked. A tool
 * that fails tells Claude so, in words, and Claude carries on: a broken lookup is not a broken
 * conversation.
 *
 * There is a ceiling on steps so a confused model cannot loop on the owner's credit.
 */

import type { Claude, ContentBlock, Message, ToolSpec, Usage } from "./claude.ts";
import { addUsage, costOf, NO_USAGE } from "./cost.ts";

export type Tool = ToolSpec & {
	run(input: Record<string, unknown>): Promise<unknown>;
};

export type ToolCall = { name: string; input: Record<string, unknown>; ok: boolean };

export type Turn = {
	reply: string;
	/** Everything said this turn, tool calls included, to carry into the next one. */
	messages: Message[];
	calls: ToolCall[];
	usage: Usage;
	costUsd: number;
};

const MAX_STEPS = 8;
/** A tool answer longer than this is cut, so one huge lookup cannot eat the owner's credit. */
const MAX_RESULT = 24_000;

export async function converse(request: {
	claude: Claude;
	model: string;
	system: string;
	messages: Message[];
	tools: Tool[];
	maxTokens?: number;
}): Promise<Turn> {
	const messages = [...request.messages];
	const calls: ToolCall[] = [];
	let usage = NO_USAGE;
	const specs = request.tools.map(({ name, description, input_schema }) => ({
		name,
		description,
		input_schema,
	}));

	for (let step = 0; step < MAX_STEPS; step += 1) {
		const answer = await request.claude({
			model: request.model,
			system: request.system,
			// A copy: what was sent stays what was sent, whatever is added after.
			messages: [...messages],
			tools: specs,
			maxTokens: request.maxTokens ?? 2_000,
		});
		usage = addUsage(usage, answer.usage);
		messages.push({ role: "assistant", content: answer.content });

		const uses = answer.content.filter(
			(block): block is Extract<ContentBlock, { type: "tool_use" }> => block.type === "tool_use",
		);
		if (answer.stopReason !== "tool_use" || uses.length === 0) {
			return {
				reply: textOf(answer.content),
				messages,
				calls,
				usage,
				costUsd: costOf(request.model, usage),
			};
		}

		const results: ContentBlock[] = [];
		for (const use of uses) {
			const tool = request.tools.find((each) => each.name === use.name);
			try {
				if (!tool) throw new Error(`there is no tool called ${use.name}`);
				const output = await tool.run(use.input ?? {});
				const text = typeof output === "string" ? output : JSON.stringify(output);
				results.push({ type: "tool_result", tool_use_id: use.id, content: clip(text) });
				calls.push({ name: use.name, input: use.input ?? {}, ok: true });
			} catch (error) {
				const why = error instanceof Error ? error.message : String(error);
				results.push({ type: "tool_result", tool_use_id: use.id, content: why, is_error: true });
				calls.push({ name: use.name, input: use.input ?? {}, ok: false });
			}
		}
		messages.push({ role: "user", content: results });
	}

	return {
		reply:
			"I went around in circles on that one and stopped, so as not to spend more of your credit. Try asking it a simpler way.",
		messages,
		calls,
		usage,
		costUsd: costOf(request.model, usage),
	};
}

const textOf = (content: ContentBlock[]) =>
	content
		.filter((block): block is Extract<ContentBlock, { type: "text" }> => block.type === "text")
		.map((block) => block.text)
		.join("\n\n")
		.trim();

const clip = (text: string) =>
	text.length <= MAX_RESULT
		? text
		: `${text.slice(0, MAX_RESULT)}\n[cut: the rest was too long to send]`;
