/**
 * A worker that keeps working until it cannot.
 *
 * Writes a file every 400ms under a capability it holds. It is never signalled,
 * never told to stop, and never checks whether it should. It stops because its
 * next authorization is refused, which is the entire claim of the emergency
 * stop: workers do not cooperate with it.
 */

import { writeFileSync } from "node:fs";
import type { Executor } from "@maschina/worker";
import { httpControlPlane, performEffect } from "@maschina/worker";

const [baseUrl, capabilityId, worker, prefix] = process.argv.slice(2);
if (!baseUrl || !capabilityId || !worker || !prefix) {
	throw new Error("usage: stop-child <base> <cap> <worker> <prefix>");
}

const plane = httpControlPlane(baseUrl);
const write: Executor = async (effect) => {
	writeFileSync(effect.target, String(effect.payload.content ?? ""), { mode: 0o600 });
	return { wrote: true };
};

for (let step = 1; step <= 12; step++) {
	const report = await performEffect(
		plane,
		{ worker, objective: "obj_slice8", reasoning: `step ${step}` },
		{
			capabilityId,
			operation: "write",
			target: `${prefix}-${step}.txt`,
			payload: { content: `step ${step}\n` },
		},
		"idempotent",
		write,
	);

	if (!report.performed) {
		// Not a check this worker chose to make. `performEffect` cannot proceed
		// without an authorization, so there is no path here that ignores it.
		console.log(`DENIED at step ${step}: ${report.reason} (${report.detail})`);
		process.exit(0);
	}
	console.log(`wrote step ${step}`);
	await new Promise((resolve) => setTimeout(resolve, 400));
}
console.log("finished all steps without ever being stopped");
