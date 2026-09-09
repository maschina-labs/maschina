/**
 * The model, as an effect. `03-RUNTIME` §2, `04-WORKERS` §7, `ADR-009`.
 *
 * A model call is authorised, recorded and metered like any other effect. It is
 * not free, not special, and not exempt from the log.
 *
 * **This runs in the control plane and nowhere else.** Two rules put it here
 * before cost was ever considered: workers never hold credentials, the broker
 * performs credentialed effects (`05-CAPABILITIES` §5), and the worker execution
 * path must be physically incapable of spawning a process (`ADR-003` §3). A
 * worker asks for a model call over HTTP and never learns how one is made.
 */

import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { ModelClass } from "@maschina/core";

const run = promisify(execFile);

/**
 * Which concrete model answers for a class.
 *
 * The mapping is runtime configuration, which is the whole point of naming a
 * class in the grant: when a provider ships something new one entry changes and
 * no capability ever granted has to be rewritten. The log stays concrete because
 * every Outcome records which model actually answered.
 */
const MODELS: Partial<Record<ModelClass, string>> = {
	fast: "claude-haiku-4-5-20251001",
	reasoning: "claude-opus-5",
	code: "claude-sonnet-5",
	long_context: "claude-sonnet-5",
	// `embedding` is deliberately absent. The CLI does not produce embeddings,
	// and mapping it to a chat model to avoid an empty cell would answer an
	// embedding request with prose. Nothing in Stage 0 asks for one.
};

/**
 * The system prompt, replacing the CLI's own.
 *
 * Replacing rather than appending, because the default one describes an agent
 * with tools, a working directory and a project. None of that is true here and
 * describing it invites the model to look for it.
 */
const SYSTEM_PROMPT =
	"You answer the question you are given, using only what is in it. " +
	"You have no tools, no files, and no project.";

/**
 * A directory with nothing in it, used as the working directory for every call.
 *
 * Found by probing rather than by reading documentation. Run from the repository
 * the CLI loaded `CLAUDE.md` and the working tree into the call, and answered
 * questions by citing "the project instructions". That is `07-CONTEXT-MEMORY` §2
 * violated at the source: repository contents are untrusted content, and this
 * was feeding them in as instruction on every call.
 */
const NOWHERE = join(tmpdir(), "maschina-model-cwd");

/**
 * The flags that make this a model call rather than an agent session.
 *
 * Each one closes something a probe found open, in this order:
 *
 *   --tools ""            No tools exist. An allowlist of nothing, not a
 *                         denylist: the first attempt enumerated every built in
 *                         tool by name and the model reached straight past it
 *                         for an MCP tool from the operator's global config.
 *                         A denylist of things that can hurt you is always
 *                         missing the next one.
 *   --strict-mcp-config   Load no MCP servers at all, so that whole surface is
 *                         absent rather than merely denied.
 *   --restricted          Ignore user, project and local settings files, so the
 *                         call does not depend on how the machine is configured.
 *   --permission-prompts none
 *                         Nothing can be approved, so a tool that survived the
 *                         above still cannot run.
 *   --disable-slash-commands
 *                         Skills are instructions from disk. Same argument.
 *
 * Together these took a call from 18,650 input tokens to 411, and from four
 * turns of reaching for tools to one turn of answering.
 */
const CONTAINMENT = [
	"--tools",
	"",
	"--strict-mcp-config",
	"--restricted",
	"--permission-prompts",
	"none",
	"--disable-slash-commands",
];

export interface ModelRequest {
	readonly modelClass: ModelClass;
	readonly prompt: string;
	/**
	 * Micro-dollars of list value still available on the capability. Passed to
	 * the CLI as a hard ceiling, so the provider refuses an overspend rather than
	 * Maschina noticing one after the money is gone.
	 */
	readonly budget: number;
}

export interface ModelResult {
	readonly text: string;
	/** What actually answered, not what was asked for. */
	readonly model: string;
	/** List value in micro-dollars, as an integer. `ADR-009` §3. */
	readonly cost: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly cacheCreationTokens: number;
	readonly cacheReadTokens: number;
	readonly durationMs: number;
}

/** Raised when a model call cannot be metered or contained. Never retried. */
export class ModelCallRefused extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ModelCallRefused";
	}
}

function integer(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new ModelCallRefused(
			`the model reported no readable ${field}, so this call cannot be metered. ` +
				"An unmetered call is not a cheap call (P8: ambiguity blocks).",
		);
	}
	return Math.round(value);
}

/**
 * Did anything other than answering happen?
 *
 * A pure model call takes exactly one turn. Using a tool forces another, so this
 * catches a tool that was never on the denylist, including one that does not
 * exist yet. That is why it is here rather than trusting the flags.
 */
function assertNoToolUse(report: Record<string, unknown>): void {
	const denials = report.permission_denials;
	if (Array.isArray(denials) && denials.length > 0) {
		throw new ModelCallRefused(
			`the model tried to use ${denials.length} tool(s). A model call that reaches ` +
				"for the world is a containment failure, not a call that went wrong.",
		);
	}
	const turns = report.num_turns;
	if (typeof turns === "number" && turns > 1) {
		throw new ModelCallRefused(
			`the model took ${turns} turns, so it did something other than answer. ` +
				"A step is one decision effect and at most one world effect (03-RUNTIME §2).",
		);
	}
}

export async function invokeModel(request: ModelRequest): Promise<ModelResult> {
	const model = MODELS[request.modelClass];
	if (model === undefined) {
		throw new ModelCallRefused(
			`no model is mapped to the ${request.modelClass} class, so this cannot be answered. ` +
				"Suspending is the honest outcome; substituting a different class is not.",
		);
	}

	const started = Date.now();
	let raw: string;
	try {
		mkdirSync(NOWHERE, { recursive: true });
		const { stdout } = await run(
			"claude",
			[
				"-p",
				request.prompt,
				"--output-format",
				"json",
				"--model",
				model,
				"--system-prompt",
				SYSTEM_PROMPT,
				// The ceiling the provider itself enforces, in dollars.
				"--max-budget-usd",
				(request.budget / 1_000_000).toFixed(6),
				...CONTAINMENT,
			],
			{ cwd: NOWHERE, maxBuffer: 32 * 1024 * 1024 },
		);
		raw = stdout;
	} catch (cause) {
		throw new ModelCallRefused(
			`the model could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`,
		);
	}

	let report: Record<string, unknown>;
	try {
		report = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		throw new ModelCallRefused(
			"the model returned something that is not JSON, so it cannot be read",
		);
	}

	if (report.is_error === true) {
		throw new ModelCallRefused(
			`the model reported an error: ${String(report.result ?? "no detail")}`,
		);
	}
	assertNoToolUse(report);

	const usage = (report.usage ?? {}) as Record<string, unknown>;
	// Cost is dollars as a float on the wire and micro-dollars as an integer in
	// the log, because floating point money accumulates error over a long
	// objective and the log is permanent.
	const cost = microDollars(report);

	return {
		text: String(report.result ?? ""),
		model,
		cost,
		inputTokens: integer(usage.input_tokens, "input token count"),
		outputTokens: integer(usage.output_tokens, "output token count"),
		cacheCreationTokens: integer(
			usage.cache_creation_input_tokens ?? 0,
			"cache creation tokens",
		),
		cacheReadTokens: integer(usage.cache_read_input_tokens ?? 0, "cache read tokens"),
		durationMs: Date.now() - started,
	};
}

function microDollars(report: Record<string, unknown>): number {
	const dollars = report.total_cost_usd;
	if (typeof dollars !== "number" || !Number.isFinite(dollars) || dollars < 0) {
		throw new ModelCallRefused(
			"the model reported no readable cost, so this call cannot be metered. " +
				"An unmetered call is not a cheap call (P8: ambiguity blocks).",
		);
	}
	return Math.round(dollars * 1_000_000);
}
