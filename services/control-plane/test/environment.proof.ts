/**
 * Environment proof, slices 1 to 6. The window reads, answers, allows, stops, is told, and shows what things cost.
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

import { readFileSync } from "node:fs";
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
	settle,
	stateObjective,
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

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
