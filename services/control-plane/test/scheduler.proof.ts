/**
 * Stage 1, slice 2 proof. The scheduler, and waking up.
 *
 * `STAGE_1_PLAN` slice 2:
 *
 *   "Suspend a worker with a resume time one minute out and let it wake itself.
 *    Put the machine to sleep mid-objective and confirm it continues on wake
 *    without a human. Turn the wake assertion on and confirm the machine stays
 *    up while work is in flight and sleeps normally once it is not."
 *
 * The distinction being proven: a worker waiting for a **time** resumes itself,
 * and a worker waiting for a **person** does not, however long it waits. Getting
 * that wrong means either waking somebody to watch a clock, or waiting forever
 * for a question nobody was asked.
 *
 * `15-OPEN-QUESTIONS` Q10 asks whether that deserves to be its own failure
 * class. This is the implementation that answers it.
 *
 * Run: pnpm proof
 */

import { serve } from "@hono/node-server";
import { appPool, getSuspension, read, suspendAsking, suspendUntil } from "@maschina/db";
import { check, resetLog, verdict } from "../../../packages/db/test/harness.ts";
import { Daemon } from "../../node/src/daemon.ts";
import { stayAwake } from "../../node/src/stay-awake.ts";
import { createApp } from "../src/app.ts";

const PORT = 8789;
const BASE = `http://127.0.0.1:${PORT}`;
const quiet = () => {
	/* the daemon narrates; the proof does the talking */
};

async function main(): Promise<void> {
	await resetLog();
	const pool = appPool();
	const server = serve({ fetch: createApp(pool).fetch, port: PORT, hostname: "127.0.0.1" });

	console.log("\nStage 1 slice 2: waiting for a clock, and waiting for a person\n");

	// 1. Two ways to stop, and they are not the same.
	console.log("1. A worker waiting for a time, and one waiting for a person");
	const soon = new Date(Date.now() + 1_500);
	await suspendUntil(pool, "worker:quota", null, "the provider's quota is spent", soon);
	await suspendAsking(
		pool,
		"worker:blocked",
		null,
		"no capabilities are held for this objective",
		"which capabilities should this worker hold, and over what?",
	);

	const waitingOnTime = await getSuspension(pool, "worker:quota");
	const waitingOnPerson = await getSuspension(pool, "worker:blocked");
	check("one is waiting for a time", waitingOnTime?.kind === "until", waitingOnTime?.kind);
	check(
		"and says when",
		waitingOnTime?.resumeAt !== null,
		waitingOnTime?.resumeAt?.toISOString(),
	);
	check("the other is waiting for a person", waitingOnPerson?.kind === "question");
	check(
		"and asks something answerable, not just that it is stuck",
		(waitingOnPerson?.question ?? "").includes("which capabilities"),
		waitingOnPerson?.question ?? "",
	);

	// 2. A resume time is never invented.
	console.log("\n2. A resume time is never guessed");
	let refusedBadTime = "";
	try {
		await suspendUntil(pool, "worker:x", null, "unknown", new Date("not a date"));
	} catch (error: unknown) {
		refusedBadTime = error instanceof Error ? error.message : String(error);
	}
	check("an unreadable time is refused", refusedBadTime.length > 0);
	check(
		"and it says to ask a person instead of picking a number",
		refusedBadTime.includes("suspend with a question"),
		refusedBadTime.slice(0, 60),
	);

	let refusedNoQuestion = "";
	try {
		await suspendAsking(pool, "worker:x", null, "stuck", "   ");
	} catch (error: unknown) {
		refusedNoQuestion = error instanceof Error ? error.message : String(error);
	}
	check("and a suspension with no question is refused too", refusedNoQuestion.length > 0);
	check(
		'because "it is stuck" is a status, not something a person can answer',
		refusedNoQuestion.includes("not something a person can answer"),
	);

	// 3. Nothing is due yet.
	console.log("\n3. Before the time arrives, nothing is due");
	const dueEarly = (await (await fetch(`${BASE}/suspensions?due=1`)).json()) as unknown[];
	check(
		"the one waiting for a time is not due yet",
		dueEarly.length === 0,
		`${dueEarly.length}`,
	);

	// 4. The daemon wakes it, with nobody asking.
	console.log("\n4. The daemon wakes it when the time arrives, with nobody asking");
	const daemon = new Daemon({
		controlPlaneUrl: BASE,
		node: "node:scheduler",
		worker: "worker:daemon",
		leaseTtlMs: 5_000,
		renewEveryMs: 500,
		pollEveryMs: 200,
		log: quiet,
		run: async () => {
			/* nothing to run; this slice is about waking */
		},
	});
	await daemon.start();

	await waitFor(async () => (await getSuspension(pool, "worker:quota")) === null, 8_000);
	const quotaAfter = await getSuspension(pool, "worker:quota");
	check("the one waiting for a time carried on", quotaAfter === null);

	const resumed = (await read(pool, { actor: "worker:quota" })).filter(
		(e) => e.type === "worker.resumed",
	);
	check("and it is recorded, not silent", resumed.length === 1);
	check(
		"saying what made it possible",
		String(resumed[0]?.payload.because).includes("the time it was waiting for"),
		String(resumed[0]?.payload.because).slice(0, 60),
	);

	// 5. The one waiting for a person is left alone.
	console.log("\n5. The one waiting for a person is left alone");
	const blockedAfter = await getSuspension(pool, "worker:blocked");
	check("it is still waiting", blockedAfter !== null);
	check("still asking the same thing", blockedAfter?.kind === "question");
	check(
		"and nothing resumed it, because a clock does not answer a question",
		(await read(pool, { actor: "worker:blocked" })).filter((e) => e.type === "worker.resumed")
			.length === 0,
	);

	await daemon.stop("the proof is finished");

	// 6. Staying awake, opt in and honest about it.
	console.log("\n6. Staying awake is opt in, and says what it can promise");
	const off = stayAwake(false, quiet);
	off.hold("nothing");
	check("off by default: nothing is held", !off.held);

	const on = stayAwake(true, quiet);
	check(
		"it states what this platform can actually do",
		on.capability.length > 0,
		on.capability,
	);
	on.hold("the proof");
	const heldSomething = on.held;
	on.release();
	check("holding and releasing does not throw", !on.held);
	check(
		"and on macOS it really holds something",
		process.platform !== "darwin" || heldSomething,
		process.platform === "darwin"
			? "caffeinate spawned"
			: `not applicable on ${process.platform}`,
	);
	check(
		"it does not claim to survive a closed lid, because it cannot",
		process.platform !== "darwin" || on.capability.includes("not sleep from closing the lid"),
		on.capability,
	);

	await new Promise<void>((resolve) => server.close(() => resolve()));
	await pool.end();
	verdict("Stage 1 slice 2 proof");
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await condition()) return;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
