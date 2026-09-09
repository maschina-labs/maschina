/**
 * Slice 4 proof. The model as an effect.
 *
 * STAGE_0_PLAN slice 4:
 *
 *   "The worker decides what to write and writes it. The log shows the model
 *    call as an Intent and Outcome with actual cost, tokens and model version.
 *    Confirm `granted - reserved - settled` is correct after a run. Set a spend
 *    limit low enough to be exhausted mid-objective and confirm the worker
 *    suspends rather than degrading to a cheaper model silently."
 *
 * Advances criterion 2, and the metering half of criterion 9.
 *
 * This one spends real money, in the sense that it consumes real tokens against
 * a real subscription. It is deliberately small: two calls to the cheapest class.
 *
 * Run: pnpm proof
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { serve } from "@hono/node-server";
import { appPool, getCapability, grant, read } from "@maschina/db";
import {
	EFFECT_INTENDED,
	EFFECT_OUTCOME,
	filesystemExecutor,
	httpControlPlane,
	modelExecutor,
	performEffect,
} from "@maschina/worker";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";

const SANDBOX = "/tmp/maschina-slice4-sandbox";
const PORT = 8798;
const BASE = `http://127.0.0.1:${PORT}`;

/** One dollar of list value, in micro-dollars. Enough for a handful of calls. */
const A_DOLLAR = 1_000_000;

async function main(): Promise<void> {
	await resetLog();
	rmSync(SANDBOX, { recursive: true, force: true });
	mkdirSync(SANDBOX, { recursive: true });

	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });
	const node = httpControlPlane(BASE);

	console.log("\nSlice 4: the model is an effect, not an exception\n");

	// 1. Authority over a model is held the same way as authority over a disk.
	console.log("1. A model is a resource authority is held over");
	const brain = await grant(pool, {
		holder: "worker:w1",
		resource: "model",
		operations: ["invoke"],
		scope: "fast",
		limits: { granted: A_DOLLAR, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	const disk = await grant(pool, {
		holder: "worker:w1",
		resource: "filesystem",
		operations: ["write", "create"],
		scope: SANDBOX,
		effectClass: "idempotent",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});
	check("the capability names a class, not a vendor's model", brain.scope === "fast");
	check("the only model operation is invoke", brain.operations.join(",") === "invoke");
	check("it starts with its full budget available", brain.limits.granted === A_DOLLAR);
	check(
		"nothing is reserved or settled yet",
		brain.limits.reserved === 0 && brain.limits.settled === 0,
	);

	// 2. The worker decides what to write, rather than being told.
	console.log("\n2. The worker decides, rather than executing a hardcoded action");
	const asked = await performEffect(
		node,
		{ worker: "worker:w1", objective: null, reasoning: "decide what to put in the file" },
		{
			capabilityId: brain.id,
			operation: "invoke",
			target: "fast",
			payload: {
				prompt:
					"Reply with a single short sentence, and nothing else, that a program could " +
					"write into a file as its entire contents. No quotes, no preamble.",
			},
		},
		"idempotent",
		modelExecutor(node, "worker:w1"),
	);
	check("the model answered", asked.performed && asked.result === "succeeded");
	const decided = asked.performed ? String(asked.detail.text ?? "").trim() : "";
	check("and it said something", decided.length > 0, decided.slice(0, 60));

	// 3. The model call is in the log as Intent and Outcome, with the numbers.
	console.log("\n3. The model call is recorded like any other effect");
	const events = await read(pool);
	const modelIntent = events.find(
		(e) => e.type === EFFECT_INTENDED && e.payload.operation === "invoke",
	);
	const modelOutcome = events.find(
		(e) => e.type === EFFECT_OUTCOME && e.payload.operation === "invoke",
	);
	check("an Intent was recorded for the model call", modelIntent !== undefined);
	check("an Outcome was recorded", modelOutcome !== undefined);
	check(
		"the Intent precedes the Outcome",
		modelIntent !== undefined && modelOutcome !== undefined && modelIntent.id < modelOutcome.id,
	);

	const detail = (modelOutcome?.payload.detail ?? {}) as Record<string, unknown>;
	check(
		"the Outcome names the model that actually answered",
		typeof detail.model === "string" && detail.model.length > 0,
		String(detail.model),
	);
	check(
		"the grant stayed abstract while the record went concrete",
		brain.scope === "fast" && detail.model !== "fast",
	);
	check(
		"it records what the call cost",
		typeof detail.cost === "number" && detail.cost > 0,
		`${String(detail.cost)} micro-dollars of list value`,
	);
	check(
		"and the tokens, both directions",
		typeof detail.inputTokens === "number" &&
			detail.inputTokens > 0 &&
			typeof detail.outputTokens === "number" &&
			detail.outputTokens > 0,
		`in ${String(detail.inputTokens)}, out ${String(detail.outputTokens)}`,
	);

	// 4. The three numbers add up afterwards.
	console.log("\n4. granted minus reserved minus settled is right after a run");
	const afterCall = await getCapability(pool, brain.id);
	const limits = afterCall?.limits;
	check("the reservation was released", limits?.reserved === 0);
	check(
		"what it cost is settled",
		limits !== undefined && limits.settled === detail.cost,
		`settled ${String(limits?.settled)}`,
	);
	check(
		"available is granted minus reserved minus settled",
		limits !== undefined &&
			limits.granted - limits.reserved - limits.settled === A_DOLLAR - Number(detail.cost),
	);

	// 5. What the model decided is what got written.
	console.log("\n5. The decision reaches the world through a separate capability");
	const target = `${SANDBOX}/decided.txt`;
	const wrote = await performEffect(
		node,
		{ worker: "worker:w1", objective: null, reasoning: "write what the model decided" },
		{ capabilityId: disk.id, operation: "write", target, payload: { content: `${decided}\n` } },
		"idempotent",
		filesystemExecutor,
	);
	check("the write happened", wrote.performed && wrote.result === "succeeded");
	check("the file is on disk", existsSync(target));
	check(
		"containing what the model decided, not something hardcoded",
		existsSync(target) && readFileSync(target, "utf8").trim() === decided,
	);
	check(
		"and the model capability could not have written it",
		brain.resource === "model" && !brain.operations.includes("write"),
	);

	// 6. A budget that runs out stops the worker.
	console.log("\n6. An exhausted budget suspends, it does not degrade");
	const pocketMoney = await grant(pool, {
		holder: "worker:w2",
		resource: "model",
		operations: ["invoke"],
		scope: "fast",
		// Enough for a call or two and not a third. The exact number of calls
		// depends on what the model charges, which is why the loop below stops
		// when it is told to rather than after a fixed count.
		limits: { granted: 6_000, reserved: 0, settled: 0 },
		effectClass: "idempotent",
		approval: "none",
		delegationDepth: 0,
		grantedBy: "human:ash",
	});

	let succeeded = 0;
	let refusal = "";
	for (let attempt = 0; attempt < 6 && refusal === ""; attempt++) {
		const call = await performEffect(
			node,
			{ worker: "worker:w2", objective: null, reasoning: `attempt ${attempt}` },
			{
				capabilityId: pocketMoney.id,
				operation: "invoke",
				target: "fast",
				payload: { prompt: "Reply with exactly the word: spent" },
			},
			"idempotent",
			modelExecutor(node, "worker:w2"),
		);
		if (call.performed && call.result === "succeeded") succeeded++;
		else if (!call.performed) refusal = call.reason;
	}

	check(
		"the budget funded real work before running out",
		succeeded > 0,
		`${succeeded} call(s)`,
	);
	check("and then the worker was stopped", refusal !== "", refusal);
	check(
		"stopped for being out of budget, not for something else",
		refusal === "limit_exhausted",
		refusal,
	);

	const exhausted = await getCapability(pool, pocketMoney.id);
	const left = exhausted?.limits;
	check(
		"what was spent is settled, and nothing is left held",
		left !== undefined && left.reserved === 0 && left.settled > 0,
		`settled ${String(left?.settled)}, reserved ${String(left?.reserved)}`,
	);

	const denials = (await read(pool)).filter(
		(e) => e.type === "capability.denied" && e.payload.reason === "limit_exhausted",
	);
	check("the refusal is in the log, as prominently as a use", denials.length > 0);

	// The whole point of the criterion: it stopped rather than getting cheaper.
	const usedModels = new Set(
		(await read(pool))
			.filter((e) => e.type === EFFECT_OUTCOME && e.payload.operation === "invoke")
			.map((e) => String(((e.payload.detail ?? {}) as Record<string, unknown>).model ?? ""))
			.filter((m) => m.length > 0),
	);
	check(
		"no call quietly fell back to a cheaper model",
		usedModels.size === 1,
		[...usedModels].join(", "),
	);

	// 7. A capability for one class does not reach another.
	console.log("\n7. Holding one class does not grant another");
	const wrongClass = await performEffect(
		node,
		{ worker: "worker:w1", objective: null, reasoning: "ask for a class we were not granted" },
		{
			capabilityId: brain.id,
			operation: "invoke",
			target: "reasoning",
			payload: { prompt: "Reply with exactly the word: nope" },
		},
		"idempotent",
		modelExecutor(node, "worker:w1"),
	);
	check("the stronger class was refused", !wrongClass.performed);
	check(
		"because it is outside the capability's scope",
		!wrongClass.performed && wrongClass.reason === "outside_scope",
		wrongClass.performed ? "" : wrongClass.reason,
	);

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
	verdict("Slice 4 proof");
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
