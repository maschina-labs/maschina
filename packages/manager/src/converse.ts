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

import type { Claude, ContentBlock, Effort, Message, ToolSpec, Usage } from "./claude.ts";
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
	/** How each step ended and what kinds of block it held, for the logs. Never the words themselves. */
	steps: { stopReason: string; blocks: string[] }[];
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
	effort?: Effort;
}): Promise<Turn> {
	const messages = [...request.messages];
	const calls: ToolCall[] = [];
	const steps: Turn["steps"] = [];
	// Everything Claude wrote this turn. It often answers in the same step as its last look, so the final
	// step alone can be empty while the answer sits one step earlier.
	const written: string[] = [];
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
			maxTokens: request.maxTokens ?? 16_000,
			effort: request.effort ?? "medium",
		});
		usage = addUsage(usage, answer.usage);
		messages.push({ role: "assistant", content: answer.content });
		steps.push({
			stopReason: answer.stopReason,
			blocks: answer.content.map((block) => block.type),
		});
		const text = textOf(answer.content);
		if (text) written.push(text);

		const uses = answer.content.filter(
			(block): block is Extract<ContentBlock, { type: "tool_use" }> => block.type === "tool_use",
		);
		if (answer.stopReason !== "tool_use" || uses.length === 0) {
			return {
				reply: replyFrom(text, written, answer.stopReason),
				messages,
				calls,
				usage,
				steps,
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
		steps,
		costUsd: costOf(request.model, usage),
	};
}

/** The answer to show: this step's words, or the turn's if this step said nothing, and why it stopped. */
function replyFrom(last: string, written: string[], stopReason: string): string {
	const said = last || written.join("\n\n");
	if (stopReason === "max_tokens")
		return `${said}\n\n[I ran out of room for this answer. Ask me to go on.]`.trim();
	if (said) return said;
	return `I looked, then wrote nothing back (Claude stopped with "${stopReason}"). That is a fault on Maschina's side, not yours. Ask again.`;
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
