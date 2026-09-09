/**
 * A node that takes a lease, starts an objective, and dies in the middle of it.
 *
 * Spawned twice by the slice 5 proof. The first run dies; the second run is
 * given nothing but the objective id and has to work out the rest from the log.
 *
 * The argument that matters is the one that is missing: nothing tells the second
 * run what the first run was doing. If it needed telling, resuming would depend
 * on a human restating context, which is exactly what criterion 4 says must not
 * be necessary.
 */

import type { Event } from "@maschina/core";
import type { Executor } from "@maschina/worker";
import {
	httpControlPlane,
	performEffect,
	recover,
	resolutionFor,
	WorkerFenced,
} from "@maschina/worker";

const [baseUrl, mode, worker, objective, capabilityId, sandbox] = process.argv.slice(2);
if (!baseUrl || !mode || !worker || !objective || !capabilityId || !sandbox) {
	throw new Error(
		"usage: resume-child <baseUrl> <crash|resume> <worker> <objective> <cap> <dir>",
	);
}

// Narrowed once, so the closures below do not each have to re-prove it.
const objectiveId: string = objective;

/** The objective: three files, written in order. Deliberately boring and checkable. */
const STEPS = ["one.txt", "two.txt", "three.txt"];

async function takeLease(): Promise<bigint> {
	const response = await fetch(`${baseUrl}/leases`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ worker, node: `node:${mode}`, ttlMs: 60_000 }),
	});
	const lease = (await response.json()) as { epoch: string };
	return BigInt(lease.epoch);
}

const epoch = await takeLease();
const plane = httpControlPlane(baseUrl, epoch);

// What has already happened. Folded from the log, not from anything this
// process was told, because on a resume there is nothing to have been told.
const history = recover(await readLog());
const done = new Set(
	history.finished.filter((f) => f.result === "succeeded").map((f) => f.target),
);

for (const step of history.unfinished) {
	// An effect caught in the crash window. The class was frozen into the Intent
	// before the effect ran, so what to do about it was decided in advance.
	console.log(
		`[${mode}] unfinished: ${step.target} (${step.effectClass}) -> ${resolutionFor(step.effectClass)}`,
	);
}

const writer: Executor = async (effect) => {
	const { writeFileSync } = await import("node:fs");
	writeFileSync(effect.target, String(effect.payload.content ?? ""), { mode: 0o600 });
	return { bytes: String(effect.payload.content ?? "").length };
};

try {
	for (const [index, name] of STEPS.entries()) {
		const target = `${sandbox}/${name}`;
		if (done.has(target)) {
			console.log(`[${mode}] already done: ${name}`);
			continue;
		}

		// The first run dies partway through the second step, after its Intent is
		// durable and before its Outcome is. SIGKILL is uncatchable, so nothing
		// gets a chance to tidy up or write a resume file.
		const suicidal: Executor = async () => {
			process.kill(process.pid, "SIGKILL");
			return {};
		};

		const dying = mode === "crash" && index === 1;

		await performEffect(
			plane,
			{ worker, objective, reasoning: `step ${index + 1} of ${STEPS.length}` },
			{ capabilityId, operation: "write", target, payload: { content: `${name} done\n` } },
			"idempotent",
			dying ? suicidal : writer,
		);
		console.log(`[${mode}] wrote: ${name}`);
	}
	console.log(`[${mode}] complete`);
} catch (error: unknown) {
	if (error instanceof WorkerFenced) {
		// The correct response, and the only one. There is nothing to retry: a
		// newer lease exists, so this process does not own the work any more.
		console.log(`[${mode}] FENCED, halting: ${error.message.slice(0, 80)}`);
		process.exit(3);
	}
	throw error;
}

async function readLog(): Promise<Event[]> {
	const response = await fetch(
		`${baseUrl}/events?objective=${encodeURIComponent(objectiveId)}`,
	);
	const wire = (await response.json()) as Record<string, unknown>[];
	return wire.map((e) => ({
		id: BigInt(String(e.id)),
		recordedAt: new Date(String(e.recordedAt)),
		actor: String(e.actor),
		objective: e.objective === null ? null : String(e.objective),
		type: String(e.type),
		payload: e.payload as Record<string, unknown>,
		epoch: BigInt(String(e.epoch)),
		causation: e.causation === null ? null : BigInt(String(e.causation)),
	}));
}
