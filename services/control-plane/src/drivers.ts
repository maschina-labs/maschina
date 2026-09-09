/**
 * The providers Maschina can actually reach.
 *
 * One real one and two that report themselves unavailable until configured. The
 * unavailable ones are not stubs to be filled in later: they are how the system
 * says "you have not set this up" rather than failing at the moment somebody
 * needed it.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ModelClass } from "@maschina/core";
import { modelFor } from "./config.ts";
import { invokeModel, ModelCallRefused } from "./model.ts";
import type {
	Provider,
	ProviderAnswer,
	ProviderDriver,
	ProviderRequest,
	ProviderState,
} from "./provider.ts";

const run = promisify(execFile);

/**
 * The Claude Code CLI, on a subscription. `ADR-009`.
 *
 * Contained rather than trusted: no tools, no MCP servers, no project files, and
 * a working directory with nothing in it. All of that lives in `model.ts`, which
 * this wraps rather than replaces.
 */
export function subscriptionDriver(): ProviderDriver {
	const classes: ModelClass[] = ["fast", "reasoning", "code", "long_context"];
	const models: Partial<Record<ModelClass, string>> = {};
	for (const modelClass of classes) {
		const model = modelFor(modelClass);
		if (model !== undefined) models[modelClass] = model;
	}

	const provider: Provider = {
		id: "claude-cli",
		kind: "subscription",
		models,
		// Nothing is billed per call on a subscription. The numbers in the log are
		// what the tokens are worth, not money spent. `ADR-009` §3.
		billed: false,
	};

	return {
		provider,

		async check(): Promise<ProviderState> {
			try {
				await run("claude", ["--version"], { timeout: 10_000 });
				return { available: true };
			} catch (cause) {
				return {
					available: false,
					reason: "unavailable",
					detail: cause instanceof Error ? cause.message.slice(0, 80) : "no claude on PATH",
				};
			}
		},

		async ask(request: ProviderRequest): Promise<ProviderAnswer> {
			const result = await invokeModel(request);
			return { ...result, provider: provider.id };
		},
	};
}

/**
 * A local model, over an OpenAI-shaped endpoint.
 *
 * Ollama, LM Studio, llama.cpp and most of the rest speak it. Off unless
 * `MASCHINA_LOCAL_MODEL_URL` is set, and it reports itself unavailable rather
 * than pretending, so the log says "you have not configured this" instead of
 * failing at the moment somebody needed it.
 */
export function localDriver(): ProviderDriver {
	const url = process.env.MASCHINA_LOCAL_MODEL_URL;
	const model = process.env.MASCHINA_LOCAL_MODEL ?? "local";

	const provider: Provider = {
		id: "local",
		kind: "local",
		// A local model answers whichever classes it is pointed at. Naming them
		// explicitly rather than claiming all of them: a small local model is not
		// a `reasoning` model just because nothing else is running.
		models: url === undefined ? {} : { fast: model, code: model },
		billed: false,
	};

	return {
		provider,

		async check(): Promise<ProviderState> {
			if (url === undefined) {
				return {
					available: false,
					reason: "unavailable",
					detail: "MASCHINA_LOCAL_MODEL_URL is not set",
				};
			}
			try {
				const response = await fetch(`${url}/v1/models`, {
					signal: AbortSignal.timeout(5_000),
				});
				return response.ok
					? { available: true }
					: { available: false, reason: "unavailable", detail: `responded ${response.status}` };
			} catch (cause) {
				return {
					available: false,
					reason: "unavailable",
					detail: cause instanceof Error ? cause.message.slice(0, 80) : "unreachable",
				};
			}
		},

		async ask(request: ProviderRequest): Promise<ProviderAnswer> {
			if (url === undefined) throw new ModelCallRefused("no local model is configured");
			const started = Date.now();

			const response = await fetch(`${url}/v1/chat/completions`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					model,
					messages: [{ role: "user", content: request.prompt }],
					stream: false,
				}),
			});
			if (!response.ok) {
				throw new ModelCallRefused(`the local model refused: ${response.status}`);
			}

			const body = (await response.json()) as {
				choices?: { message?: { content?: string } }[];
				usage?: { prompt_tokens?: number; completion_tokens?: number };
			};

			return {
				text: body.choices?.[0]?.message?.content ?? "",
				model,
				provider: provider.id,
				// A local model costs electricity, which is not micro-dollars of
				// list value and is not worth pretending to measure. Zero is the
				// honest number, and `billed: false` says why.
				cost: 0,
				inputTokens: body.usage?.prompt_tokens ?? 0,
				outputTokens: body.usage?.completion_tokens ?? 0,
				durationMs: Date.now() - started,
			};
		},
	};
}

/** Every provider this machine could use, in preference order. */
export function drivers(): ProviderDriver[] {
	// Local first when it exists: it costs nothing and leaves the machine's
	// subscription for work that needs the better model.
	const order = (process.env.MASCHINA_PROVIDERS ?? "local,claude-cli").split(",");
	const all = new Map([
		["claude-cli", subscriptionDriver()],
		["local", localDriver()],
	]);
	return order
		.map((id) => all.get(id.trim()))
		.filter((driver): driver is ProviderDriver => driver !== undefined);
}
