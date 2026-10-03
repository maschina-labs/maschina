/**
 * Talking to Claude, on the owner's own key.
 *
 * Plain HTTP rather than a client library: one endpoint, a handful of fields, and nothing else to keep up
 * to date. The system prompt and the tools are marked for caching, since they are the same on every turn
 * of a conversation and are most of what is sent, which makes each turn after the first far cheaper.
 */

import { MaschinaError } from "@maschina/core";

export const ANTHROPIC_API = "https://api.anthropic.com";

/** The model the manager thinks with, and a cheaper one for routine looks. */
export const MODELS = { think: "claude-sonnet-5", glance: "claude-haiku-4-5-20251001" } as const;

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };

export type ContentBlock =
	| { type: "text"; text: string }
	| { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
	| { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export type Message = { role: "user" | "assistant"; content: string | ContentBlock[] };

export type Usage = {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
};

export type ClaudeReply = { content: ContentBlock[]; stopReason: string; usage: Usage };

export type ClaudeRequest = {
	model: string;
	system: string;
	messages: Message[];
	tools: ToolSpec[];
	maxTokens: number;
};

export type Claude = (request: ClaudeRequest) => Promise<ClaudeReply>;

const count = (value: unknown) => (typeof value === "number" && value >= 0 ? value : 0);

export function claude(
	key: string,
	options: { baseUrl?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number } = {},
): Claude {
	const call = options.fetch ?? globalThis.fetch;
	return async (request) => {
		const tools = request.tools.map((tool, index) =>
			index === request.tools.length - 1 ? { ...tool, cache_control: { type: "ephemeral" } } : tool,
		);
		let response: Response;
		try {
			response = await call(`${options.baseUrl ?? ANTHROPIC_API}/v1/messages`, {
				method: "POST",
				headers: {
					"x-api-key": key,
					"anthropic-version": "2023-06-01",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					model: request.model,
					max_tokens: request.maxTokens,
					system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
					messages: request.messages,
					...(tools.length ? { tools } : {}),
				}),
				signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
			});
		} catch {
			throw new MaschinaError("unavailable", "Claude could not be reached");
		}
		const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
		if (!response.ok) {
			const message = (body["error"] as { message?: string } | undefined)?.message;
			if (response.status === 401 || response.status === 403)
				throw new MaschinaError("forbidden", "Anthropic refused your key: replace it in settings");
			if (response.status === 400 && message?.includes("credit"))
				throw new MaschinaError("limit_exceeded", "Your Anthropic credit has run out");
			if (response.status === 429)
				throw new MaschinaError(
					"limit_exceeded",
					"Anthropic is limiting your key: try again shortly",
				);
			throw new MaschinaError(
				"unavailable",
				`Claude answered ${response.status}${message ? `: ${message}` : ""}`,
			);
		}
		const usage = (body["usage"] ?? {}) as Record<string, unknown>;
		return {
			content: Array.isArray(body["content"]) ? (body["content"] as ContentBlock[]) : [],
			stopReason: typeof body["stop_reason"] === "string" ? body["stop_reason"] : "unknown",
			usage: {
				inputTokens: count(usage["input_tokens"]),
				outputTokens: count(usage["output_tokens"]),
				cacheReadTokens: count(usage["cache_read_input_tokens"]),
				cacheWriteTokens: count(usage["cache_creation_input_tokens"]),
			},
		};
	};
}
