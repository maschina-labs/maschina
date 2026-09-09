/**
 * Stage 1, slice 3 proof. Provider sessions.
 *
 * `STAGE_1_PLAN` slice 3:
 *
 *   "Run the same objective against two providers and confirm the log says which
 *    answered. Exhaust one and confirm the worker suspends rather than silently
 *    using another, then confirm an explicit fallback is recorded as an event."
 *
 *   "Watch for: fallback becoming silent degradation."
 *
 * Scripted providers, on purpose. What is being proven is Maschina's choosing,
 * not any vendor's answering, and a scripted provider can be made to run out of
 * quota on demand. `model-live.proof.ts` covers the real one.
 *
 * Run: pnpm proof
 */

import { serve } from "@hono/node-server";
import { appPool, getSuspension, grant, read } from "@maschina/db";
import { httpControlPlane, modelExecutor, performEffect } from "@maschina/worker";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";
import { choose, type ProviderDriver, type ProviderState } from "../src/provider.ts";

const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
// A second port rather than reusing the first: closing a server and binding the
// same port immediately raced, and the worker called before it was listening.
const PORT_OUT = 8787;
const BASE_OUT = `http://127.0.0.1:${PORT_OUT}`;

/** A provider that answers, until it is told to stop. */
function scripted(
	id: string,
	options: {
		classes: string[];
		billed: boolean;
		state?: () => ProviderState;
		cost?: number;
	},
): ProviderDriver & { calls: number } {
	const models = Object.fromEntries(options.classes.map((c) => [c, `${id}-model`]));
	const driver = {
		calls: 0,
		provider: { id, kind: "local" as const, models, billed: options.billed },
		async check(): Promise<ProviderState> {
			return options.state?.() ?? { available: true };
		},
		async ask(request: { modelClass: string; prompt: string; budget: number }) {
			driver.calls++;
			return {
				text: `${id} answered a ${request.modelClass} question`,
				model: `${id}-model`,
				provider: id,
				cost: options.cost ?? 1_000,
				inputTokens: 10,
				outputTokens: 5,
				durationMs: 1,
			};
		},
	};
	return driver as ProviderDriver & { calls: number };
}

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();

	console.log("\nStage 1 slice 3: which provider answered, and why\n");

	// 1. Choosing, before anything runs.
	console.log("1. A class is served by whichever provider can answer it");
	const cheap = scripted("cheap", { classes: ["fast"], billed: false });
	const expensive = scripted("expensive", { classes: ["fast", "reasoning"], billed: true });

	const forFast = await choose([cheap, expensive], "fast");
	check("the first that can answer wins", forFast.driver?.provider.id === "cheap");
	const forReasoning = await choose([cheap, expensive], "reasoning");
	check(
		"and a class only one serves goes to that one",
		forReasoning.driver?.provider.id === "expensive",
	);

	const forEmbedding = await choose([cheap, expensive], "embedding");
	check("a class nobody serves chooses nothing", forEmbedding.driver === null);
	check(
		"and says so, rather than substituting something else",
		forEmbedding.why.includes("no provider serves"),
		forEmbedding.why,
	);
	check("with no retry time, because no clock fixes it", forEmbedding.retryAt === null);

	// 2. Out of quota is different from missing.
	console.log("\n2. Out of quota and unavailable are different answers");
	const later = new Date(Date.now() + 3_600_000);
	const outOfQuota = scripted("out", {
		classes: ["fast"],
		billed: false,
		state: () => ({ available: false, reason: "quota", until: later }),
	});
	const broken = scripted("broken", {
		classes: ["fast"],
		billed: false,
		state: () => ({ available: false, reason: "unavailable", detail: "not installed" }),
	});

	const allOut = await choose([outOfQuota], "fast");
	check("out of quota chooses nothing", allOut.driver === null);
	check("but says when it will be back", allOut.retryAt?.getTime() === later.getTime());

	const allBroken = await choose([broken], "fast");
	check("unavailable chooses nothing either", allBroken.driver === null);
	check(
		"and offers no time, because waiting will not install anything",
		allBroken.retryAt === null,
	);

	const noFallback = await choose([outOfQuota, cheap], "fast");
	check(
		"by default, one being out does not silently promote another",
		noFallback.driver === null,
		noFallback.why,
	);
	check(
		"and it says another could have, but was not permitted",
		noFallback.why.includes("falling back was not permitted"),
	);

	const withFallback = await choose([outOfQuota, cheap], "fast", { allowFallback: true });
	check("asked for, a fallback is allowed", withFallback.driver?.provider.id === "cheap");
	check("and it knows that is what happened", withFallback.fellBack);
	check(
		"naming who should have answered",
		withFallback.instead === "out",
		withFallback.instead ?? "",
	);

	// 3. Through the whole path: the log says who answered.
	console.log("\n3. The log records which provider answered, every time");
	const server = serve({
		fetch: createApp(pool, undefined, [cheap, expensive]).fetch,
		port: PORT,
		hostname: "127.0.0.1",
	});
	const node = httpControlPlane(BASE);

	const brain = await grant(pool, {
		holder: "worker:w1",
		resource: "model",
		operations: ["invoke"],
		scope: "fast",
		limits: { granted: 1_000_000, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});

	const answered = await performEffect(
		node,
		{ worker: "worker:w1", objective: null, reasoning: "ask something" },
		{
			capabilityId: brain.id,
			operation: "invoke",
			target: "fast",
			payload: { prompt: "hello" },
		},
		"idempotent",
		modelExecutor(node, "worker:w1"),
	);
	check("it answered", answered.performed && answered.result === "succeeded");

	const records = (await read(pool)).filter((e) => e.type === "model.answered");
	check("and the log says which provider did", records.length === 1);
	check(
		"naming it",
		String(records[0]?.payload.provider) === "cheap",
		String(records[0]?.payload.provider),
	);
	check(
		"and whether that provider costs money, because a budget means different things",
		records[0]?.payload.billed === false,
	);
	check(
		"the class asked for is recorded too",
		String(records[0]?.payload.modelClass) === "fast",
	);

	// 4. Everything out means suspend, not substitute.
	console.log("\n4. When everything serving a class is out, it waits rather than substituting");
	const quotaOnly = serve({
		fetch: createApp(pool, undefined, [outOfQuota, expensive]).fetch,
		port: PORT_OUT,
		hostname: "127.0.0.1",
	});
	const node2 = httpControlPlane(BASE_OUT);

	// Its own capability. Using another worker's would be refused at the authority
	// check and never reach the provider choice, which is what happened first.
	const brain2 = await grant(pool, {
		holder: "worker:w2",
		resource: "model",
		operations: ["invoke"],
		scope: "fast",
		limits: { granted: 1_000_000, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});

	const callsBefore = expensive.calls;
	const refused = await performEffect(
		node2,
		{ worker: "worker:w2", objective: null, reasoning: "ask when the cheap one is out" },
		{
			capabilityId: brain2.id,
			operation: "invoke",
			target: "fast",
			payload: { prompt: "hello" },
		},
		"idempotent",
		modelExecutor(node2, "worker:w2"),
	);
	check("the call did not succeed", !refused.performed || refused.result !== "succeeded");
	check(
		"and nothing else answered in its place",
		expensive.calls === callsBefore,
		`${expensive.calls - callsBefore} substitute call(s)`,
	);
	check(
		"even though another provider could have served the class",
		expensive.provider.models.fast !== undefined,
		"the substitute existed and was not used",
	);

	const waiting = await getSuspension(pool, "worker:w2");
	check("the worker is waiting", waiting !== null);
	check("for a time, because a quota lifts", waiting?.kind === "until", waiting?.kind);
	check(
		"the time the provider gave, not one anybody invented",
		waiting?.resumeAt?.getTime() === later.getTime(),
		waiting?.resumeAt?.toISOString(),
	);

	// 5. A class nobody serves asks a person instead.
	console.log("\n5. A class nobody serves asks a person, because no clock fixes it");
	const embeddingCap = await grant(pool, {
		holder: "worker:w3",
		resource: "model",
		operations: ["invoke"],
		scope: "embedding",
		limits: { granted: 1_000_000, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		checkpoint: "none",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	await performEffect(
		node2,
		{ worker: "worker:w3", objective: null, reasoning: "ask for a class nobody serves" },
		{
			capabilityId: embeddingCap.id,
			operation: "invoke",
			target: "embedding",
			payload: { prompt: "hello" },
		},
		"idempotent",
		modelExecutor(node2, "worker:w3"),
	);
	const asking = await getSuspension(pool, "worker:w3");
	check("it is waiting on a person", asking?.kind === "question", asking?.kind);
	check(
		"asking something answerable",
		(asking?.question ?? "").includes("which provider should serve"),
		asking?.question ?? "",
	);

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await new Promise<void>((resolve) => quotaOnly.close(() => resolve()));
	await pool.end();
	verdict("Stage 1 slice 3 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
