/**
 * Environment proof, slices 1 to 7. The window reads, answers, allows, stops, is told, shows what things cost, and states work.
 *
 * `ENVIRONMENT_PLAN` slice 1:
 *
 *   "Append an event with the CLI and watch it appear in the window without a
 *    restart. Stop the control plane and confirm the window says what happened
 *    rather than going blank. Confirm the renderer has no network access of its
 *    own."
 *
 * The window itself is not driven here. What is proved is the read path the
 * window uses and the boundaries around it, because those are the parts that can
 * be wrong silently. A rendered table is checked by looking at it.
 *
 * It lives here rather than in `apps/desktop` on purpose. That package cannot
 * depend on the database or on a server, and `check-node-boundary.mjs` fails the
 * build if it ever does. So the proof runs where those exist and reads the
 * desktop's source across the boundary rather than pulling it across.
 *
 * Run: pnpm proof
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import type { Contract } from "@maschina/core";
import { hashContract } from "@maschina/core";
import {
	append,
	appPool,
	authorize,
	getSuspension,
	grant,
	PAYLOAD_V,
	read,
	recordEvaluation,
	recordStep,
	reserve,
	resume,
	settle,
	stateObjective,
	suspendAsking,
	suspendIfStalled,
	whatDidItCost,
} from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { createApp } from "../src/app.ts";

const PORT = 8794;
const desktop = new URL("../../../apps/desktop/src/", import.meta.url).pathname;

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });

	// The client reads its base from the environment, so point it at this one.
	process.env.MASCHINA_CONTROL_PLANE_URL = `http://127.0.0.1:${PORT}`;
	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");

	console.log("\nEnvironment slice 1: the window reads the log\n");

	try {
		// 1. It reads what is actually there.
		console.log("1. What the log holds is what the window is given");
		const empty = await plane.events();
		check("an empty log reads as empty, not as an error", empty.ok && empty.value.length === 0);

		await append(pool, {
			actor: "human:ash",
			objective: null,
			epoch: 0n,
			type: "objective.stated",
			payload: { v: PAYLOAD_V, statement: "something to look at" },
		});
		const one = await plane.events();
		check("an appended event is readable", one.ok && one.value.length === 1);
		check(
			"with its type intact",
			one.ok && one.value[0]?.type === "objective.stated",
			one.ok ? (one.value[0]?.type ?? "") : "",
		);
		check(
			"and its payload, not a summary of it",
			one.ok && one.value[0]?.payload.statement === "something to look at",
		);
		check(
			"ids arrive as strings, because they do not survive JSON as numbers",
			one.ok && typeof one.value[0]?.id === "string",
			one.ok ? typeof one.value[0]?.id : "",
		);

		// 2. Filtering matches the CLI, because both go through the same surface.
		console.log("\n2. The same question asked here and from the CLI has one answer");
		await append(pool, {
			actor: "worker:a",
			objective: null,
			epoch: 0n,
			type: "worker.did_something",
			payload: { v: PAYLOAD_V },
		});
		const mine = await plane.events({ actor: "worker:a" });
		check("filtering by actor works", mine.ok && mine.value.length === 1);
		check("and returns the right one", mine.ok && mine.value[0]?.actor === "worker:a");
		const limited = await plane.events({ limit: 1 });
		check("a limit is respected", limited.ok && limited.value.length === 1);

		// 3. Losing the control plane is reported, never swallowed.
		console.log("\n3. Losing the control plane says so");
		await new Promise<void>((resolve) => server.close(() => resolve()));
		const gone = await plane.events();
		check("it does not pretend the log is empty", !gone.ok);
		check(
			"it says where it looked and what to do",
			!gone.ok && gone.problem.includes(String(PORT)) && gone.problem.includes("pnpm dev"),
			!gone.ok ? gone.problem : "",
		);
		check(
			"and it is not an exception the caller has to catch",
			typeof gone === "object" && "ok" in gone,
		);
	} finally {
		await pool.end();
	}

	// 4. The boundaries, read from the source rather than assumed.
	console.log("\n4. The window cannot reach past the control plane");
	// Comments stripped first. The first version of this section asserted against
	// whole files and failed on three checks, every one of them matching the
	// documentation rather than the code: the preload's comment saying there is no
	// `invoke(channel, ...)` passthrough, and two comments naming the database
	// package they promise never to import. A check that reads prose proves
	// nothing about behaviour.
	const code = (file: string) =>
		readFileSync(join(desktop, file), "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");

	const main = code("main/index.ts");
	const preload = code("preload/index.ts");
	const client = code("main/control-plane.ts");
	const app = code("renderer/App.tsx");

	check("context isolation is on", main.includes("contextIsolation: true"));
	check("node integration is off", main.includes("nodeIntegration: false"));
	check("the renderer is sandboxed", main.includes("sandbox: true"));
	// A control inside a drag region receives no clicks on macOS, and looks
	// exactly like a control that is simply broken. The tabs shipped that way and
	// were found by trying them.
	const style = readFileSync(join(desktop, "renderer/index.css"), "utf8");
	if (style.includes("-webkit-app-region: drag")) {
		// Blanket, not per control. The tabs shipped broken this way and then the
		// stop dialog did, because it renders inside the header and inherited the
		// drag region: the overlay could not be typed in or dismissed. Checking one
		// class at a time would have caught the first and missed the second.
		check(
			"everything inside the title bar opts out of the drag region",
			/\.titlebar\s\*\s*\{[^}]*-webkit-app-region:\s*no-drag/.test(style),
			"a drag region swallows clicks and keystrokes from everything inside it",
		);
	}

	const stopView = readFileSync(join(desktop, "renderer/Stop.tsx"), "utf8");
	check(
		"and the dialog can always be left",
		stopView.includes("Escape") && stopView.includes("stopping__backdrop"),
		"nobody should ever be stuck in a dialog, least of all this one",
	);

	check(
		"the renderer never calls fetch itself",
		!app.includes("fetch("),
		"it asks the main process, which asks the control plane",
	);
	check(
		"the bridge exposes named operations, not a channel",
		!preload.includes("invoke: (") && !/invoke\(\s*channel/.test(preload),
	);
	// This asserted zero writes until slice 3, when answering a suspended worker
	// became the first thing on this surface that changes anything. The claim
	// narrows rather than disappearing: one named effect, and nothing that
	// touches the log.
	// Named effects, counted by name rather than by how many times fetch is
	// written. What matters is that each one is a specific operation somebody
	// chose to expose, not that they share a helper.
	const effects = ["/resume", "/approve", "/emergency-stop"];
	check(
		"everything that changes something is a named operation",
		effects.every((e) => client.includes(e)),
		effects.join(", "),
	);
	check(
		"and none of them writes to the log",
		!/\/events['"`]/.test(client) && !/append/.test(client.replace(/\/\*[\s\S]*?\*\//g, "")),
		"a viewer that can write to the event log is not a viewer",
	);
	check(
		"and the app imports no database package",
		!main.includes("@maschina/db") && !client.includes("@maschina/db"),
	);

	// ── Slice 2 ───────────────────────────────────────────────────────────────
	await slice2();

	// ── Slice 3 ───────────────────────────────────────────────────────────────
	await slice3();

	// ── Slice 4 ───────────────────────────────────────────────────────────────
	await slice4();

	// ── Slice 5 ───────────────────────────────────────────────────────────────
	await slice5();

	// ── Slice 6 ───────────────────────────────────────────────────────────────
	await slice6();

	// ── Slice 7 ───────────────────────────────────────────────────────────────
	await slice7();

	// ── Slice 8 ───────────────────────────────────────────────────────────────
	await slice8();

	// ── Slice 9 ───────────────────────────────────────────────────────────────
	await slice9();

	// ── Slice 10 ──────────────────────────────────────────────────────────────
	slice10();

	// ── Slice 11 ──────────────────────────────────────────────────────────────
	slice11();

	// ── Slice 12 ──────────────────────────────────────────────────────────────
	slice12();

	// ── Where the control plane is (#278) ─────────────────────────────────────
	await addressing();

	verdict("Environment proof");
}

/**
 * Slice 2: objectives, and one objective in detail.
 *
 *   "An objective stated from the CLI appears, and its state changes as a worker
 *    works. A criterion satisfied at step two shows as satisfied at step two,
 *    read from `criterion.satisfied` events rather than recomputed at the end."
 *
 *   "Watch for: showing the contract as though it were editable."
 */
async function slice2(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT + 1, hostname: "127.0.0.1" });
	process.env.MASCHINA_CONTROL_PLANE_URL = `http://127.0.0.1:${PORT + 1}`;
	// The client reads its address per call, so pointing it here needs no reimport.
	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");

	console.log("\n5. Objectives reach the window with their contracts intact");
	try {
		const CONTRACT: Contract = {
			criteria: [
				{
					id: "exists",
					criterion: "the file is on the remote",
					verifyBy: "query the git remote",
					strength: "mechanical",
					evidence: ["the file, read back"],
				},
				{
					id: "accurate",
					criterion: "it says what the history shows",
					verifyBy: "a worker that did not do the work reads both",
					strength: "independent",
					evidence: ["the commits", "the file"],
				},
			],
			nonGoals: ["changes to any other file"],
			failureConditions: ["the repository is left broken"],
		};

		const admitted = await stateObjective(pool, {
			statement: "Something a person asked for",
			contract: CONTRACT,
			origin: "human:ash",
		});
		const id = admitted.objective.id;

		const list = await plane.objectives();
		check("the window sees the objective", list.ok && list.value.length === 1);
		check(
			"with the statement a person wrote",
			list.ok && list.value[0]?.statement === "Something a person asked for",
		);

		const one = await plane.objective(id);
		check("and can open one", one.ok);
		check(
			"the contract arrives whole, both criteria",
			one.ok && one.value.contract.criteria.length === 2,
			one.ok ? String(one.value.contract.criteria.length) : "",
		);
		check(
			"including how each is verified, which is what makes it checkable",
			one.ok && one.value.contract.criteria[0]?.verifyBy === "query the git remote",
		);
		check(
			"and its strength, because evidence quality is not uniform",
			one.ok && one.value.contract.criteria[1]?.strength === "independent",
		);
		check("non-goals survive", one.ok && one.value.contract.nonGoals.length === 1);
		check(
			"so do failure conditions",
			one.ok && one.value.contract.failureConditions.length === 1,
		);

		console.log("\n6. The contract is frozen, and the window is told so");
		check(
			"a hash was recorded at admission",
			one.ok && typeof one.value.contractHash === "string" && one.value.contractHash.length > 0,
		);
		check(
			"and it matches the contract that was admitted",
			one.ok && one.value.contractHash === hashContract(CONTRACT),
		);
		const surface = readFileSync(join(desktop, "renderer/Objectives.tsx"), "utf8");
		check(
			"the window renders it as frozen rather than as a field",
			surface.includes("frozen") &&
				!surface.includes("<input") &&
				!surface.includes("<textarea"),
			"a surface that looks editable teaches that a contract can be edited",
		);

		console.log("\n7. A criterion met early reads as met early");
		await recordStep(pool, "worker:doing", id, {
			artifacts: [],
			observations: ["had a look"],
			changedTheWorld: false,
			satisfied: [],
		});
		await recordStep(pool, "worker:doing", id, {
			artifacts: ["the file"],
			observations: [],
			changedTheWorld: true,
			satisfied: ["exists"],
		});
		await recordStep(pool, "worker:doing", id, {
			artifacts: [],
			observations: ["still thinking"],
			changedTheWorld: false,
			satisfied: [],
		});

		const events = await plane.events({ objective: id, limit: 500 });
		check("the window can read this objective's events", events.ok);
		const satisfiedEvents = events.ok
			? events.value.filter((e: { type: string }) => e.type === "criterion.satisfied")
			: [];
		check("one criterion is recorded satisfied", satisfiedEvents.length === 1);
		check(
			"naming which",
			satisfiedEvents[0]?.payload.criterionId === "exists",
			String(satisfiedEvents[0]?.payload.criterionId ?? ""),
		);

		// The event it was recorded at must sit before the last step, or "met at
		// step two" is a story rather than a fact.
		const steps = events.ok
			? events.value.filter((e: { type: string }) => e.type === "step.completed")
			: [];
		check("three steps were taken", steps.length === 3, String(steps.length));
		check(
			"and the criterion was satisfied before the last of them",
			BigInt(satisfiedEvents[0]?.id ?? "0") < BigInt(steps[2]?.id ?? "0"),
			"not gathered up at the end",
		);
		check(
			"the other criterion is still open",
			!satisfiedEvents.some(
				(e: { payload: { criterionId?: unknown } }) => e.payload.criterionId === "accurate",
			),
		);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await pool.end();
	}
}

/**
 * Slice 3: the queue, and answering in place.
 *
 *   "Run pnpm stall:live. It leaves a worker suspended after three null steps
 *    with a real question. The question appears in the window, an answer typed
 *    there resumes it, and the whole exchange is in the log."
 *
 * The live run needs the subscription, so what is proved here is the same
 * mechanism with the stall produced directly: a real suspension, a real question,
 * answered through the window's own code path.
 */
async function slice3(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT + 2, hostname: "127.0.0.1" });
	process.env.MASCHINA_CONTROL_PLANE_URL = `http://127.0.0.1:${PORT + 2}`;
	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");

	try {
		console.log("\n8. A worker that stopped reaches the queue as a question");
		const objective = (
			await stateObjective(pool, {
				statement: "Something that cannot be finished",
				contract: {
					criteria: [
						{
							id: "impossible",
							criterion: "a thing that cannot happen",
							verifyBy: "look",
							strength: "mechanical",
							evidence: ["nothing"],
						},
					],
					nonGoals: [],
					failureConditions: [],
				},
				origin: "human:ash",
			})
		).objective;

		// Three steps that get nowhere, which is what a real stall looks like.
		for (let i = 0; i < 3; i++) {
			await recordStep(pool, "worker:stuck", objective.id, {
				artifacts: [],
				observations: [],
				changedTheWorld: false,
				satisfied: [],
			});
		}
		const stalled = await suspendIfStalled(
			pool,
			"worker:stuck",
			objective.id,
			["impossible"],
			"asking for something that does not exist",
		);
		check("the worker suspended", stalled);

		const queue = await plane.suspensions();
		check("the window sees it", queue.ok && queue.value.length === 1);
		check(
			"as something waiting on a person, not on a clock",
			queue.ok && queue.value[0]?.kind === "question",
			queue.ok ? (queue.value[0]?.kind ?? "") : "",
		);
		const question = queue.ok ? (queue.value[0]?.question ?? "") : "";
		check("with an actual question", question.trim().endsWith("?"), question.slice(0, 70));
		check(
			"and separately, why it stopped",
			queue.ok && (queue.value[0]?.reason ?? "").includes("no artifact"),
		);

		console.log("\n9. Answering it in the window resumes the worker");
		const refusedEmpty = await plane.answer(
			"worker:stuck",
			objective.id,
			"   ",
			"human:operator",
		);
		check(
			"an empty answer is refused",
			!refusedEmpty.ok,
			"resuming with nothing would record that a person decided when nobody did",
		);
		check(
			"so the worker is still stopped",
			(await getSuspension(pool, "worker:stuck")) !== null,
		);

		const sent = await plane.answer(
			"worker:stuck",
			objective.id,
			"The capability was never granted. Ask for it and carry on.",
			"human:operator",
		);
		check("a real answer is accepted", sent.ok);
		check(
			"and the worker is no longer stopped",
			(await getSuspension(pool, "worker:stuck")) === null,
		);
		check(
			"so the queue empties",
			((await plane.suspensions()) as { value: unknown[] }).value.length === 0,
		);

		console.log("\n10. The whole exchange is in the log, including who answered");
		const events = await read(pool, { objective: objective.id });
		const resumed = events.find((e) => e.type === "worker.resumed");
		check("the resumption is recorded", resumed !== undefined);
		check(
			"with the answer itself, not a summary of it",
			String(resumed?.payload.because ?? "").startsWith("The capability was never granted"),
		);
		check(
			"and who gave it, which is what makes it instruction rather than content",
			resumed?.payload.answeredBy === "human:operator",
			String(resumed?.payload.answeredBy ?? "nobody"),
		);
		check(
			"the suspension is still in the log too, because nothing is deleted",
			events.some((e) => e.type === "worker.suspended"),
		);

		console.log("\n11. The question is answerable where it is asked");
		const queueView = readFileSync(join(desktop, "renderer/Queue.tsx"), "utf8");
		check(
			"the queue shows the question, not a status",
			queueView.includes("suspension.question") && !queueView.includes("is stuck"),
		);
		check(
			"with a box to answer it in",
			queueView.includes("textarea") && queueView.includes("queue.answer"),
			"ADR-011 section 6: everything shown is actionable where it is shown",
		);
		check(
			"and an answer that failed to send never looks like one that worked",
			queueView.includes("setRefused") && queueView.includes("still stopped"),
		);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await pool.end();
	}
}

/**
 * Slice 4: approvals, and the emergency stop.
 *
 *   "A worker blocks on an every_use capability, is released from the window,
 *    and the decision is in the log. Then a worker mid-objective is stopped from
 *    the window and stays stopped."
 *
 *   "Watch for: an approve button that approves more than the one use in front
 *    of it. And hiding the emergency stop because it looks alarming."
 */
async function slice4(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT + 3, hostname: "127.0.0.1" });
	process.env.MASCHINA_CONTROL_PLANE_URL = `http://127.0.0.1:${PORT + 3}`;
	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");

	try {
		console.log("\n12. A worker blocked on approval reaches the window");
		const capability = await grant(pool, {
			holder: "worker:careful",
			resource: "repository",
			operations: ["commit"],
			scope: "maschina-labs/maschina-sandbox",
			effectClass: "reconcilable",
			checkpoint: "none",
			approval: "every_use",
			delegationDepth: 0,
			grantedBy: "human:ash",
		});

		const blocked = await authorize(pool, {
			capabilityId: capability.id,
			holder: "worker:careful",
			operation: "commit",
			target: "maschina-labs/maschina-sandbox",
		});
		check("the worker is refused until somebody decides", !blocked.granted);
		check(
			"for wanting approval, not for anything else",
			blocked.granted === false && blocked.reason === "approval_required",
			blocked.granted === false ? blocked.reason : "",
		);

		const waiting = await plane.approvals();
		check("the window sees the request", waiting.ok && waiting.value.length === 1);
		check(
			"and what it would permit, not just its name",
			waiting.ok &&
				waiting.value[0]?.scope === "maschina-labs/maschina-sandbox" &&
				waiting.value[0]?.operations.includes("commit"),
			"approving something whose scope you cannot see is agreeing, not approving",
		);

		console.log("\n13. Refusing is recorded, not merely withheld");
		const refusedEmpty = await plane.decide(capability.id, true, "  ", "human:operator");
		check("a decision with no reason is refused", !refusedEmpty.ok);

		const refusal = await plane.decide(
			capability.id,
			false,
			"not this repository",
			"human:operator",
		);
		check("a refusal is accepted", refusal.ok);
		const refusals = (await read(pool)).filter((e) => e.type === "capability.approval_refused");
		check("and recorded", refusals.length === 1);
		check(
			"with who refused it and why",
			refusals[0]?.payload.approver === "human:operator" &&
				refusals[0]?.payload.reason === "not this repository",
			"invariant 14: denials are recorded as prominently as uses",
		);
		check(
			"and the worker is still refused",
			!(
				await authorize(pool, {
					capabilityId: capability.id,
					holder: "worker:careful",
					operation: "commit",
					target: "maschina-labs/maschina-sandbox",
				})
			).granted,
		);

		console.log("\n14. Allowing it allows exactly one use");
		const allowed = await plane.decide(
			capability.id,
			true,
			"yes, that repository",
			"human:operator",
		);
		check("the approval is accepted", allowed.ok);
		check(
			"the worker may act once",
			(
				await authorize(pool, {
					capabilityId: capability.id,
					holder: "worker:careful",
					operation: "commit",
					target: "maschina-labs/maschina-sandbox",
				})
			).granted,
		);
		check(
			"and is refused again immediately after",
			!(
				await authorize(pool, {
					capabilityId: capability.id,
					holder: "worker:careful",
					operation: "commit",
					target: "maschina-labs/maschina-sandbox",
				})
			).granted,
			"every_use means one answer authorises one action",
		);

		console.log("\n15. Stopping everything, from the window");
		const held = await grant(pool, {
			holder: "worker:busy",
			resource: "model",
			operations: ["invoke"],
			scope: "fast",
			limits: { granted: 100_000, reserved: 0, settled: 0 },
			effectClass: "idempotent",
			checkpoint: "none",
			approval: "none",
			delegationDepth: 0,
			grantedBy: "human:ash",
		});
		check(
			"a worker holds authority before the stop",
			(
				await authorize(pool, {
					capabilityId: held.id,
					holder: "worker:busy",
					operation: "invoke",
					target: "fast",
				})
			).granted,
		);

		const refusedNoReason = await plane.stopEverything("   ", "human:operator");
		check("stopping without a reason is refused", !refusedNoReason.ok);

		const stopped = await plane.stopEverything("it is doing the wrong thing", "human:operator");
		check("the stop is accepted", stopped.ok);
		check(
			"and took capabilities with it",
			stopped.ok && stopped.value.revoked.length > 0,
			stopped.ok ? `${stopped.value.revoked.length} revoked` : "",
		);
		check(
			"the worker has no authority now",
			!(
				await authorize(pool, {
					capabilityId: held.id,
					holder: "worker:busy",
					operation: "invoke",
					target: "fast",
				})
			).granted,
			"no cooperation from the worker was needed",
		);

		console.log("\n16. And it is reachable, and honest about not being a pause");
		const stopSource = readFileSync(join(desktop, "renderer/Stop.tsx"), "utf8");
		const shell = readFileSync(join(desktop, "renderer/App.tsx"), "utf8");
		check(
			"the stop is in the title bar, so it is visible from every view",
			shell.includes("<Stop />"),
			"a stop nobody can find is a stop nobody has",
		);
		check(
			"it asks before it acts",
			stopSource.includes("Stop everything?") && stopSource.includes("setAsking"),
		);
		check(
			"and says plainly that nothing comes back",
			stopSource.includes("not a pause") && stopSource.includes("comes back"),
		);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await pool.end();
	}
}

/**
 * Slice 5: told, not asking.
 *
 *   "Two windows on the same objective show the same thing within a second of an
 *    event being appended."
 *
 *   "Watch for: reaching for a websocket layer or a message broker."
 */
async function slice5(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT + 4, hostname: "127.0.0.1" });
	process.env.MASCHINA_CONTROL_PLANE_URL = `http://127.0.0.1:${PORT + 4}`;
	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");

	try {
		console.log("\n17. The database says when something is recorded");
		const told: number[] = [];
		const trouble: string[] = [];

		// Two watchers, because the claim is about two windows seeing the same
		// thing rather than about one window working.
		const stopA = plane.watch(
			() => told.push(Date.now()),
			(p: string) => p !== "" && trouble.push(p),
		);
		const stopB = plane.watch(
			() => told.push(Date.now()),
			(p: string) => p !== "" && trouble.push(p),
		);
		// Both streams need to be connected before anything is appended, or the
		// test would be measuring how fast they connect.
		await new Promise((resolve) => setTimeout(resolve, 700));

		const at = Date.now();
		await append(pool, {
			actor: "human:ash",
			objective: null,
			epoch: 0n,
			type: "note.made",
			payload: { v: PAYLOAD_V, text: "something happened" },
		});

		await new Promise((resolve) => setTimeout(resolve, 900));
		stopA();
		stopB();

		check("both watchers were told", told.length >= 2, `${told.length} notifications`);
		check(
			"within a second of it being recorded",
			told.every((t) => t - at < 1_000),
			told.map((t) => `${t - at}ms`).join(", "),
		);
		check("and neither reported trouble", trouble.length === 0, trouble.join("; "));

		console.log("\n18. Nothing was added to carry it");
		const schema = readFileSync(
			new URL("../../../packages/db/src/schema.sql", import.meta.url).pathname,
			"utf8",
		);
		check(
			"the database announces it, with a trigger",
			schema.includes("pg_notify") && schema.includes("events_announced"),
		);
		check(
			"the notification carries an id, not the event",
			schema.includes("NEW.id::text"),
			"a notification holding the event would be a second, worse copy of the log",
		);
		// Dependency names, not a substring search of the file. Grepping for "ws
		// would also match "wsl-tools", and a check that can be satisfied by
		// coincidence is not a check.
		const manifest = JSON.parse(
			readFileSync(new URL("../../../package.json", import.meta.url).pathname, "utf8"),
		) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
		const installed = new Set([
			...Object.keys(manifest.dependencies ?? {}),
			...Object.keys(manifest.devDependencies ?? {}),
		]);
		for (const banned of [
			"nats",
			"redis",
			"ioredis",
			"socket.io",
			"ws",
			"amqplib",
			"kafkajs",
		]) {
			check(`no ${banned}`, !installed.has(banned));
		}

		console.log("\n19. And the window stopped asking");
		const reading = readFileSync(join(desktop, "renderer/useLog.ts"), "utf8");
		check("it reads when it is told", reading.includes("onRecorded"));
		check(
			"and keeps a slow interval underneath rather than trusting the stream",
			/everyMs = 30_000/.test(reading),
			"a push nobody stored is a push that can be missed",
		);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await pool.end();
	}
}

/**
 * Slice 6: what finished, and what it cost.
 *
 *   "A verdict opens the thing it judged: the commit, the file, the remote state
 *    that was checked. The cost matches `maschina cost` to the micro-dollar."
 *
 *   "Watch for: showing the executor's account of its own work."
 */
async function slice6(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT + 5, hostname: "127.0.0.1" });
	process.env.MASCHINA_CONTROL_PLANE_URL = `http://127.0.0.1:${PORT + 5}`;
	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");

	try {
		console.log("\n20. A verdict reaches the window with its evidence");
		const objective = (
			await stateObjective(pool, {
				statement: "Something somebody judged",
				contract: {
					criteria: [
						{
							id: "exists",
							criterion: "the file is on the remote",
							verifyBy: "query the git remote",
							strength: "mechanical",
							evidence: ["the file, read back"],
						},
						{
							id: "accurate",
							criterion: "it says what the history shows",
							verifyBy: "somebody who did not do the work reads both",
							strength: "independent",
							evidence: ["the commits"],
						},
					],
					nonGoals: [],
					failureConditions: [],
				},
				origin: "human:ash",
			})
		).objective;

		await recordEvaluation(pool, objective.id, "worker:judge", objective.contractHash ?? "", [
			{
				criterionId: "exists",
				result: "satisfied",
				evidence: ["9152449cc9ed on main", "the file, read back from the remote"],
				method: "mechanical",
				notes: "the remote has it",
			},
			{
				criterionId: "accurate",
				result: "not_satisfied",
				evidence: ["the commit subjects"],
				method: "independent",
				notes: "it describes something the history does not show",
			},
		]);

		const judged = await plane.evaluations(objective.id);
		check("the window sees the evaluation", judged.ok && judged.value.length === 1);
		check(
			"with a verdict for each criterion",
			judged.ok && judged.value[0]?.verdicts.length === 2,
		);
		check(
			"and the evidence each rested on",
			judged.ok &&
				(judged.value[0]?.verdicts[0]?.evidence ?? []).includes("9152449cc9ed on main"),
			"a verdict that does not say what it was checked against cannot be audited later",
		);
		check(
			"and which verification strength was actually used",
			judged.ok &&
				judged.value[0]?.verdicts[0]?.method === "mechanical" &&
				judged.value[0]?.verdicts[1]?.method === "independent",
			"09-EVALUATION section 3: mechanical, independent and judgement are not the same claim",
		);
		check(
			"naming who judged, which is never the worker that did the work",
			judged.ok && judged.value[0]?.evaluator === "worker:judge",
		);
		check(
			"and what is still outstanding",
			judged.ok && (judged.value[0]?.remaining ?? []).includes("accurate"),
		);

		console.log("\n21. And what it cost, from settlements");
		const brain = await grant(pool, {
			holder: "worker:doing",
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
		// Cost is attributed through the objective's own effects, so there has to be
		// one. A reservation with nothing spending it belongs to no objective, which
		// is correct: money is attributed to what caused it.
		await append(pool, {
			actor: "worker:doing",
			objective: objective.id,
			epoch: 0n,
			type: "effect.intended",
			payload: { v: PAYLOAD_V, capabilityId: brain.id, operation: "invoke", target: "fast" },
		});
		await reserve(pool, brain.id, "worker:doing", 50_000);
		await settle(pool, brain.id, "worker:doing", 3_412, 50_000);

		const spent = await plane.cost(objective.id);
		check("the window sees the cost", spent.ok && spent.value.length === 1);
		check(
			"to the micro-dollar, matching what the query says",
			spent.ok &&
				spent.value[0]?.settled === (await whatDidItCost(pool, objective.id))[0]?.settled,
			spent.ok ? String(spent.value[0]?.settled) : "",
		);
		check(
			"broken down by resource",
			spent.ok && spent.value[0]?.resource === "model",
			spent.ok ? (spent.value[0]?.resource ?? "") : "",
		);

		console.log("\n22. Shown as evidence, not as the worker's account of itself");
		const view = readFileSync(join(desktop, "renderer/Objectives.tsx"), "utf8");
		check(
			"the window shows the evidence a verdict rested on",
			view.includes("checked against") && view.includes("verdict.evidence"),
		);
		check(
			"and who judged",
			view.includes("evaluation.evaluator"),
			"09-EVALUATION section 4: a worker may not evaluate its own objective",
		);
		check(
			"and says the cost came from settlements",
			view.includes("not from anything a worker reported"),
		);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await pool.end();
	}
}

/**
 * Slice 7: stating an objective.
 *
 *   "An objective stated in the window is admitted with a frozen contract and
 *    picked up by a worker, with no CLI involved."
 *
 *   "Watch for: becoming a chat box. And a drafted contract being accepted
 *    automatically."
 */
async function slice7(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT + 6, hostname: "127.0.0.1" });
	process.env.MASCHINA_CONTROL_PLANE_URL = `http://127.0.0.1:${PORT + 6}`;
	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");

	try {
		console.log("\n23. An objective stated in the window is admitted");
		const good = await plane.state(
			"Add a README to the sandbox repository",
			{
				criteria: [
					{
						id: "exists",
						criterion: "README.md is on the remote default branch",
						verifyBy: "query the git remote for the file at HEAD",
						strength: "mechanical",
						evidence: ["the file, read back from the remote"],
					},
				],
				nonGoals: [],
				failureConditions: [],
			},
			"human:operator",
		);
		check("it was accepted", good.ok && good.value.problems.length === 0);
		check(
			"and the contract is frozen",
			good.ok &&
				typeof good.value.objective.contractHash === "string" &&
				good.value.objective.contractHash.length > 0,
		);
		check(
			"stated by the person, not by a worker",
			good.ok && good.value.objective.origin === "human:operator",
		);

		const listed = await plane.objectives();
		check("and it is there", listed.ok && listed.value.length === 1);
		check(
			"admitted, so something can take it",
			listed.ok && listed.value[0]?.state === "admitted",
			listed.ok ? (listed.value[0]?.state ?? "") : "",
		);

		console.log("\n24. A contract that agrees to nothing is refused");
		const bad = await plane.state(
			"Do something good",
			{ criteria: [], nonGoals: [], failureConditions: [] },
			"human:operator",
		);
		check("it was refused", !bad.ok || bad.value.problems.length > 0);
		check(
			"with what is wrong, rather than an error",
			!bad.ok
				? bad.problem.length > 0
				: bad.value.problems.some((p) => p.includes("criterion")),
			!bad.ok ? bad.problem : (bad.value.problems[0] ?? ""),
		);
		const after = await plane.objectives();
		check(
			"and nothing new was admitted",
			after.ok && after.value.filter((o) => o.state === "admitted").length === 1,
			after.ok ? after.value.map((o) => o.state).join(", ") : "",
		);
		check(
			"though the refusal is in the record, with its reasons",
			after.ok && after.value.some((o) => o.state === "rejected"),
			"a refused objective is a fact, and facts are recorded",
		);

		console.log("\n25. Drafting is a model call, so it needs authority");
		const noneYet = await plane.modelCapabilities();
		check("nothing can draft yet", noneYet.ok && noneYet.value.length === 0);
		const refused = await plane.draft("Add a README", "cap_that_does_not_exist");
		check(
			"and asking anyway is refused",
			!refused.ok,
			"invariant 8: the model call is an effect, not free and not special",
		);

		await grant(pool, {
			holder: plane.DRAFTER,
			resource: "model",
			operations: ["invoke"],
			scope: "fast",
			limits: { granted: 500_000, reserved: 0, settled: 0 },
			effectClass: "idempotent",
			checkpoint: "none",
			approval: "none",
			delegationDepth: 0,
			grantedBy: "human:ash",
		});
		const now = await plane.modelCapabilities();
		check(
			"once something is granted, the window can see what to draft with",
			now.ok && now.value.length === 1 && now.value[0]?.holder === plane.DRAFTER,
		);

		console.log("\n26. And a draft is never an agreement");
		// Comments stripped first. Two checks here failed on their first run by
		// matching this file's own documentation, which is the third time that has
		// happened in this project.
		const form = readFileSync(join(desktop, "renderer/State.tsx"), "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");

		// The draft handler runs from the first line of askForADraft to the end of
		// that function, and what matters is what it does not do.
		const drafting = form.slice(
			form.indexOf("const askForADraft"),
			form.indexOf("const canDraft"),
		);
		check(
			"the draft only fills the fields",
			drafting.includes("applyDraft") && !drafting.includes("objectives.state"),
			"admitting on somebody's behalf would make the frozen hash a promise nobody made",
		);
		check(
			"stating is one action, not a conversation",
			!/messages|chat|history/.test(form),
			"08-ENVIRONMENT section 1: a chat box makes the human the scheduler again",
		);
		check(
			"and the form says the contract is about to be frozen",
			form.includes("frozen once stated"),
		);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await pool.end();
	}
}

/**
 * Slice 8: stats, levels and the heatmap.
 *
 *   "Delete every projection, rebuild, and the numbers are identical. And a test
 *    fails if any scoreboard value can reach anything a worker is given."
 *
 *   "Watch for: making it the front door."
 */
async function slice8(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT + 7, hostname: "127.0.0.1" });
	process.env.MASCHINA_CONTROL_PLANE_URL = `http://127.0.0.1:${PORT + 7}`;
	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");

	try {
		console.log("\n27. Everything counted is something that happened");
		const objective = (
			await stateObjective(pool, {
				statement: "Something to count",
				contract: {
					criteria: [
						{
							id: "one",
							criterion: "it happened",
							verifyBy: "the log",
							strength: "mechanical",
							evidence: ["events"],
						},
					],
					nonGoals: [],
					failureConditions: [],
				},
				origin: "human:ash",
			})
		).objective;

		await recordStep(pool, "worker:counted", objective.id, {
			artifacts: ["a file"],
			observations: [],
			changedTheWorld: true,
			satisfied: ["one"],
		});
		await recordStep(pool, "worker:counted", objective.id, {
			artifacts: [],
			observations: [],
			changedTheWorld: false,
			satisfied: [],
		});
		await suspendAsking(pool, "worker:counted", objective.id, "stuck", "what now?");
		await resume(pool, "worker:counted", objective.id, "carry on", undefined, "human:operator");

		const board = await plane.stats();
		check("the window sees the scoreboard", board.ok);
		check("one objective stated", board.ok && board.value.objectivesStated === 1);
		check("one criterion satisfied", board.ok && board.value.criteriaSatisfied === 1);
		check(
			"one step that got nowhere, counted rather than hidden",
			board.ok && board.value.nullSteps === 1,
			"a null step is how a worker notices it is stuck, not a failure",
		);
		check("one question asked", board.ok && board.value.questionsAsked === 1);
		check(
			"and one answered, because somebody answered it",
			board.ok && board.value.questionsAnswered === 1,
		);
		check(
			"days have something in them",
			board.ok && board.value.days.length >= 1 && board.value.streak >= 1,
		);

		console.log("\n28. There is nothing to rebuild, which is stronger");
		const before = await plane.stats();
		const after = await plane.stats();
		check(
			"reading it twice gives the same answer",
			before.ok && after.ok && JSON.stringify(before.value) === JSON.stringify(after.value),
			"nothing accumulates, because nothing is kept",
		);
		const schema = readFileSync(
			new URL("../../../packages/db/src/schema.sql", import.meta.url).pathname,
			"utf8",
		);
		// "stat" is inside "state" and "statement", which are all over the schema,
		// so the first version of this check failed on words rather than on tables.
		// What it meant to say is that the fold writes nothing.
		const fold = readFileSync(
			new URL("../../../packages/core/src/scoreboard.ts", import.meta.url).pathname,
			"utf8",
		);
		check(
			"the fold writes nothing anywhere",
			!/append|INSERT|pool|Pool/.test(fold),
			"a scoreboard cannot drift from the record because it has no record of its own",
		);
		check(
			"events is still the only table",
			(schema.match(/CREATE TABLE/gi) ?? []).length === 1,
			`${(schema.match(/CREATE TABLE/gi) ?? []).length} tables`,
		);

		console.log("\n29. No worker can see any of it");
		const source = (file: string) =>
			readFileSync(new URL(`../../../${file}`, import.meta.url).pathname, "utf8")
				.replace(/\/\*[\s\S]*?\*\//g, "")
				.replace(/^\s*\/\/.*$/gm, "");

		for (const file of [
			"packages/worker/src/index.ts",
			"packages/worker/src/model.ts",
			"packages/core/src/memory.ts",
			"packages/core/src/retrieval.ts",
		]) {
			check(
				`${file.split("/").pop()} cannot reach the scoreboard`,
				!/scoreboard|\/stats/.test(source(file)),
				"a worker that can see a number it is judged on optimises for the number",
			);
		}

		console.log("\n30. And it is not the front door");
		const shell = source("apps/desktop/src/renderer/App.tsx");
		check(
			"the window still opens on what needs a person",
			/useState<View>\("queue"\)/.test(shell),
			"08-ENVIRONMENT section 1: the queue is what needs you, this is what happened",
		);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await pool.end();
	}
}

/**
 * Slice 9: the tree and the editor.
 *
 *   "The delete test from ADR-011 section 3: remove Maschina from the machine and
 *    confirm nothing about the project is harder than before Maschina existed.
 *    The same directory opens in another editor, at the same time, with plain git
 *    history."
 *
 *   "Watch for: every reasonable-sounding request that is really make it more
 *    like VS Code."
 */
async function slice9(): Promise<void> {
	console.log("\n31. The tree is the operator's, not a worker's");

	const source = (file: string) =>
		readFileSync(new URL(`../../../${file}`, import.meta.url).pathname, "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");

	const human = source("apps/desktop/src/main/workspace.ts");
	const worker = source("packages/worker/src/filesystem.ts");

	check(
		"the two filesystem paths share no module",
		!human.includes("@maschina/worker") && !human.includes("filesystem.ts"),
		"ADR-003 section 3.2: separate modules, separate call sites",
	);
	check(
		"and no shared path resolver",
		!worker.includes("workspace"),
		"a shared resolver is where the scope check eventually gets skipped",
	);
	check(
		"the human path holds no capability check, because a person is not a worker",
		!/authorize|capability/i.test(human),
		"a worker's file access is granted and revocable; a person opening their own files is not",
	);

	console.log("\n32. Nothing outside the opened directory is expressible");
	check(
		"paths are resolved before they are compared, not inspected as strings",
		human.includes("resolve(root, path)") && human.includes("startsWith(root + sep)"),
		"inspecting strings is how traversal defences get bypassed",
	);
	check(
		"and the renderer only ever sends relative paths",
		source("apps/desktop/src/renderer/Files.tsx").includes("entry.path") &&
			!source("apps/desktop/src/renderer/Files.tsx").includes("/Users"),
	);

	console.log("\n33. The delete test: hosting, not replacing");
	check(
		"nothing writes a sidecar, an index or a lockfile",
		!/\.maschina|sidecar|\.lock|writeFile\([^)]*meta/i.test(human),
		"ADR-011 section 3: delete Maschina and the directory is exactly as it was",
	);
	check(
		"a save goes straight to the real path",
		human.includes("await writeFile(file, text") && !human.includes("copyFile"),
		"no copy, no backup, so anything else watching that directory sees the change",
	);
	// A first version of this matched /git/i, which hits ".git" in the skip list.
	// What it meant is that this module runs nothing: no git, no build, no
	// anything. It reads and writes files and that is the whole of it.
	check(
		"it runs no processes at all",
		!/child_process|execFile|spawn\(|exec\(/.test(human),
		"the history stays plain git precisely because nothing here goes near it",
	);
	check(
		"and .git is not even listed",
		human.includes('".git"'),
		"a tree that offers to edit .git is a tree that owns the repository",
	);

	console.log("\n34. The editor runs no language workers");
	// This section used to assert that no editor library existed at all, which was
	// ADR-011 section 8 having teeth while slice 9 shipped a textarea. Issue #274
	// argued the dependency in: reviewing a worker's change in a textarea is not
	// reviewing. Deleting the guard rather than replacing it would leave "do not
	// become VS Code" as a comment, so what it now checks is the boundary that
	// actually holds: highlighting and a diff, and none of the worker backed half.
	const code = source("apps/desktop/src/renderer/Code.tsx");

	// Both of these pull the four language services, and Vite emits a worker chunk
	// for anything in the module graph before tree shaking can remove it.
	// `import type` is erased and reaches no bundle, so only a value import counts.
	// The first version of this check did not make that distinction and failed on
	// the type import, which is the check being too blunt rather than a finding.
	check(
		"the package entry is not imported for value",
		!/^import\s+(?!type\b)[^;]*from ["']monaco-editor["']/m.test(code),
		"monaco-editor and languages/register.all.js both drag in the services",
	);
	check("nor languages/register.all.js", !code.includes("languages/register.all"));
	for (const service of [
		"features/css",
		"features/html",
		"features/json",
		"features/typescript",
	]) {
		check(`no ${service} language service`, !code.includes(`languages/${service}`));
	}

	check(
		"asking for a worker throws rather than returning one",
		/getWorker\([^)]*\)[^{]*\{[\s\S]{0,200}?throw new Error/.test(code),
		"undefined would fail somewhere deep instead; this fails where the decision is",
	);

	// The policy is what makes the above matter rather than being a preference.
	const html = readFileSync(
		new URL("../../../apps/desktop/src/renderer/index.html", import.meta.url).pathname,
		"utf8",
	);
	check("the content security policy has no worker-src", !html.includes("worker-src"));
	check("and no blob:", !html.includes("blob:"));
	check(
		"and script-src is still self only",
		/script-src 'self'/.test(html) && !/script-src[^;]*unsafe/.test(html),
	);

	const manifest = JSON.parse(
		readFileSync(
			new URL("../../../apps/desktop/package.json", import.meta.url).pathname,
			"utf8",
		),
	) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
	const installed = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
	check(
		"monaco-editor is a direct dependency, argued for in #274",
		installed.includes("monaco-editor"),
	);
	// The loader fetches Monaco from a CDN by default, which the policy forbids and
	// which would make the editor depend on being online.
	check("and not through @monaco-editor/react", !installed.includes("@monaco-editor/react"));
	check(
		"no second editor",
		!installed.includes("codemirror") && !installed.includes("ace-builds"),
	);

	console.log("\n34b. A change is shown as the thing that changed");
	// `08-ENVIRONMENT` section 1: a surface fails when it shows state you have to
	// go elsewhere to act on. A unified patch is a description of a change, and
	// issue #274's whole argument was that reading one is not reviewing.
	const gitView = source("apps/desktop/src/renderer/Git.tsx");
	check("the git view renders a diff editor", gitView.includes("<Diff"));
	check("and no longer prints a patch", !gitView.includes("colourless"));

	// The two sides come from two modules on purpose. `ADR-003` section 3.2: git
	// does not turn an operator's path into an absolute one, `workspace.ts` does.
	check("the committed side comes from git", gitView.includes("git.show("));
	check(
		"and the working side from the operator's own files",
		gitView.includes("workspace.read("),
	);
	const gitMain = source("apps/desktop/src/main/git.ts");
	check(
		"git reads the commit, never the working file",
		!/readFileSync|readFile\(|node:fs/.test(gitMain),
		"a second path resolver is where the scope check gets skipped",
	);
}

/**
 * Slice 10: the terminal.
 *
 *   "A test proves the worker execution path cannot spawn an unsandboxed
 *    process, and that the two paths share no module."
 *
 *   "Watch for: a shared path-resolution helper. Both terminals being on screen
 *    at once makes this more tempting to break, not less."
 *
 * This is the constraint `ADR-003` marks as never reopening, so the checks are
 * about what cannot happen rather than about what works.
 */
function slice10(): void {
	console.log("\n35. The human shell and the worker path share nothing");

	const source = (file: string) =>
		readFileSync(new URL(`../../../${file}`, import.meta.url).pathname, "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");

	const human = source("apps/desktop/src/main/terminal.ts");

	check(
		"the human terminal is its own module",
		human.includes('from "node-pty"'),
		"ADR-003 section 3.1: separate modules with separate call sites",
	);
	check("and imports nothing from the worker", !human.includes("@maschina/worker"));
	check(
		"it is not one invocation behind a flag",
		!/isWorker|forWorker|sandboxed\s*[?:]/.test(human),
		"a flag will eventually be passed wrong",
	);

	console.log("\n36. The worker path cannot reach a pseudoterminal at all");

	const workerFiles = readdirSync(
		new URL("../../../packages/worker/src", import.meta.url).pathname,
	).filter((f) => f.endsWith(".ts"));

	for (const file of workerFiles) {
		const text = source(`packages/worker/src/${file}`);
		check(
			`${file} cannot spawn a shell`,
			!/node-pty|child_process|execFile|spawn\(/.test(text),
			"a pseudoterminal on the operator's shell has no isolation boundary at all",
		);
	}

	const manifest = JSON.parse(
		readFileSync(
			new URL("../../../packages/worker/package.json", import.meta.url).pathname,
			"utf8",
		),
	) as { dependencies?: Record<string, string> };
	check(
		"and node-pty is not even a dependency of the worker package",
		!Object.keys(manifest.dependencies ?? {}).includes("node-pty"),
		"physically incapable, rather than careful",
	);

	console.log("\n37. It is the operator's own shell, unbounded on purpose");
	check(
		"it starts their login shell, not a chosen one",
		human.includes("process.env.SHELL"),
		"a terminal that starts a different shell behaves unlike every other on the machine",
	);
	check(
		"there is no command allowlist",
		!/allowlist|allowed|permitted|forbidden/i.test(human),
		"05-CAPABILITIES section 7: allowlisted commands compose into arbitrary behaviour",
	);
	check(
		"resizing is handled, so anything that draws its own interface draws right",
		human.includes("resize"),
	);
	check(
		"and no shell outlives the window",
		source("apps/desktop/src/main/index.ts").includes("terminal.stopAll()"),
	);
}

/**
 * Slice 11: git in one place.
 *
 *   "Watch for: blurring the operator's git with the worker's capability. A
 *    worker committing is brokered, recorded and revocable. A human committing
 *    is a human committing."
 */
function slice11(): void {
	console.log("\n38. The operator's git is not the worker's capability");

	const source = (file: string) =>
		readFileSync(new URL(`../../../${file}`, import.meta.url).pathname, "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");

	const human = source("apps/desktop/src/main/git.ts");
	const worker = source("packages/worker/src/repository.ts");

	check("the two share no module", !human.includes("@maschina/worker"));
	check("and the worker knows nothing of this one", !worker.includes("main/git"));
	check(
		"the human path has no capability, because a person is not a worker",
		!/capabilityId|authorize/.test(human),
		"a worker commits through a broker and never sees a credential; a person just commits",
	);
	check(
		"and it holds no credential of its own either",
		!/token|password|GITHUB_TOKEN|Authorization/i.test(human),
		"it runs git, and git already knows how to authenticate as the person",
	);

	console.log("\n39. It runs real git, so the history is ordinary");
	check(
		"the real binary, on the real repository",
		human.includes("execFile") && human.includes('"git"'),
		"08-ENVIRONMENT section 2 lists git as never replaced, and ADR-011 did not reverse it",
	);
	check(
		"arguments are an array, never a string",
		!/execFile\(\s*`/.test(human) && human.includes("[...args]"),
		"a filename with a space in it is a filename, not a second command",
	);

	console.log("\n40. And there is no force-push");
	check(
		"force appears nowhere",
		!/--force|-f\b|forceWithLease/.test(human),
		"03-RUNTIME section 5: an unsafe effect escalates rather than being made easy",
	);
	check(
		"push takes no arguments that could add one",
		/export async function push\(cwd: string\)/.test(human),
		"if somebody needs to force-push, they have a terminal",
	);
}

/**
 * Slice 12: packaging.
 *
 *   "Watch for: an auto-updater that does not verify signatures. `12-SECURITY`
 *    section 7: an updating desktop application is a code execution path into
 *    the operator's machine."
 *
 * The build itself is checked by running it. What is checked here is the
 * configuration, because the dangerous parts of packaging are the settings
 * nobody looks at again.
 */
function slice12(): void {
	console.log("\n41. It packages as an application, with its own identity");

	const config = readFileSync(
		new URL("../../../apps/desktop/electron-builder.yml", import.meta.url).pathname,
		"utf8",
	);

	check("it has a name of its own", config.includes("productName: Maschina"));
	check("and an identifier", /appId: [a-z.]+/.test(config));
	check(
		"and the icon",
		config.includes("icon: build/icon.icns"),
		"a packaged bundle carries its own icon, so the development workarounds retire",
	);

	console.log("\n42. The native module survives being packaged");
	check(
		"node-pty is unpacked from the archive",
		config.includes("asarUnpack") && config.includes("node-pty"),
		"a compiled binary cannot run from inside an asar: the loader needs a real file",
	);

	console.log("\n43. Nothing pretends to be signed, and nothing updates itself");
	check(
		"signing is explicitly off rather than misconfigured",
		config.includes("identity: null"),
		"a build that looks signed and is not is worse than an honest unsigned one",
	);
	check(
		"and there is no auto-updater",
		config.includes("publish: null") && !/autoUpdate|electron-updater/.test(config),
		"12-SECURITY section 7: an updater that cannot verify a signature is a hole, not a feature",
	);

	const manifest = JSON.parse(
		readFileSync(
			new URL("../../../apps/desktop/package.json", import.meta.url).pathname,
			"utf8",
		),
	) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
	check(
		"electron-updater is not even installed",
		!Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }).includes(
			"electron-updater",
		),
	);
}

/**
 * Where the control plane is, which the packaged application has to be told.
 *
 * Issue #278. `pnpm dev` starts a control plane and the window together, so the
 * window could assume 127.0.0.1:8787 and be right every time. The packaged
 * application is only the window: it opened, assumed the same address, and
 * reported that nothing was listening on a port the operator had never chosen.
 *
 * What is proved here is that the three states are distinguishable, because that
 * is the part that was wrong. Not set, set and unreachable, and set and working
 * have three different fixes and used to produce one message.
 */
async function addressing(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT + 8, hostname: "127.0.0.1" });
	const here = `http://127.0.0.1:${PORT + 8}`;

	const plane = await import("../../../apps/desktop/src/main/control-plane.ts");
	const format = await import("../../../apps/desktop/src/main/address-format.ts");

	console.log("\n44. Nothing is assumed when no address has been set");
	// Earlier sections steer the client with this. Clear it, or the thing being
	// proved here is hidden by the thing that made the other sections work.
	const previous = process.env.MASCHINA_CONTROL_PLANE_URL;
	delete process.env.MASCHINA_CONTROL_PLANE_URL;
	plane.pointAt(null);

	const nowhere = await plane.health();
	check("with nothing set, reading the log does not succeed", !nowhere.ok);
	check(
		"and it says it is unset rather than unreachable",
		!nowhere.ok && nowhere.unset === true,
		!nowhere.ok ? nowhere.problem : "it succeeded, which it cannot have",
	);
	check(
		"the message names the missing setting, not a port nobody chose",
		!nowhere.ok && !nowhere.problem.includes("8787"),
		!nowhere.ok ? nowhere.problem : "",
	);

	console.log("\n45. What an address is allowed to be");
	// Real inputs through the real function. The rules matter: this string is
	// concatenated into every request URL the window makes.
	const refused: readonly [string, string][] = [
		["", "empty"],
		["127.0.0.1:8787", "no scheme"],
		["file:///etc/passwd", "not http"],
		["javascript:alert(1)", "not http"],
		["http://user:secret@host", "credentials in the address"],
		["http://127.0.0.1:8787?drop=1", "a query string"],
	];
	for (const [input, why] of refused) {
		check(`refused: ${why}`, format.validate(input) !== null, JSON.stringify(input));
	}
	for (const good of ["http://127.0.0.1:8787", "https://plane.example.com", " http://x.dev "]) {
		check(
			`allowed: ${good.trim()}`,
			format.validate(good) === null,
			String(format.validate(good)),
		);
	}
	check("a trailing slash is removed", format.tidy("http://x.dev/") === "http://x.dev");

	// The rule is enforced where the request is made, not only where the address
	// was saved. It arrives from a file on disk and then decides where every
	// request goes, which is what CodeQL js/file-access-to-http objected to.
	check(
		"the client refuses an address that is not one",
		plane.pointAt("file:///etc/passwd") === false,
	);
	const afterBad = await plane.health();
	check(
		"and is left unset rather than pointed at it",
		!afterBad.ok && afterBad.unset === true,
		!afterBad.ok ? afterBad.problem : "it succeeded, which it cannot have",
	);
	check("a good one is accepted", plane.pointAt("http://127.0.0.1:1") === true);

	console.log("\n46. Being told where it is makes it work");
	plane.pointAt(here);
	const reachable = await plane.health();
	check(
		"pointed at a real control plane, the log reads",
		reachable.ok,
		JSON.stringify(reachable),
	);

	console.log("\n47. Set and not answering is not the same as not set");
	plane.pointAt("http://127.0.0.1:9");
	const dead = await plane.health();
	check("an address that answers nothing fails", !dead.ok);
	check(
		"and it is not reported as unset, because one was set",
		!dead.ok && dead.unset === undefined,
		!dead.ok ? dead.problem : "",
	);

	console.log("\n48. The override still wins, so pnpm dev is unchanged");
	process.env.MASCHINA_CONTROL_PLANE_URL = here;
	plane.pointAt("http://127.0.0.1:9");
	const overridden = await plane.health();
	check("what is set in the surroundings beats what was saved", overridden.ok);

	console.log("\n49. The operator's own surfaces do not depend on it at all");
	// The shell, the files and git are the person's own. An unset address must not
	// black them out: starting a control plane from Maschina's own terminal and
	// then connecting to it is a real way to use this.
	for (const own of ["terminal.ts", "workspace.ts", "git.ts"]) {
		const source = readFileSync(join(desktop, "main", own), "utf8");
		check(
			`${own} cannot reach the control plane`,
			!source.includes("control-plane.ts") && !source.includes("address.ts"),
		);
	}

	console.log("\n50. The setting is not part of the record");
	// 02-CORE: the log holds facts about work. Which address somebody pointed a
	// window at is not one, so it lives on the machine and never reaches the log.
	const addressSource = readFileSync(join(desktop, "main", "address.ts"), "utf8");
	check(
		"the address module has no route to the log",
		!addressSource.includes("@maschina/db") && !addressSource.includes("append"),
	);
	const events = await read(pool);
	check("and setting one recorded nothing", events.length === 0, `${events.length} event(s)`);

	if (previous !== undefined) process.env.MASCHINA_CONTROL_PLANE_URL = previous;
	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
