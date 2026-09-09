/**
 * Asking the model, as an effect.
 *
 * This is an `Executor`, so a model call takes exactly the same road as writing
 * a file: authorise, record the Intent, do it, record the Outcome. There is no
 * separate path for "just thinking". `03-RUNTIME` §2 says the model call is an
 * effect, and treating it as free is how a system ends up unable to answer what
 * a week cost or which model made a bad decision.
 *
 * All this does is hand the request across the boundary. The worker cannot make
 * a model call itself: it holds no credential and cannot spawn a process, so the
 * only thing it can do is ask.
 */

import type { ModelClass } from "@maschina/core";
import type { ControlPlane } from "./control-plane.ts";
import type { Executor } from "./effect.ts";

/**
 * Build the executor for a worker's model calls.
 *
 * The holder is bound in when the executor is made rather than read from the
 * effect, so a worker cannot spend against a capability by naming a different
 * holder in a payload.
 */
export function modelExecutor(controlPlane: ControlPlane, holder: string): Executor {
	return async (effect) => {
		const prompt = effect.payload.prompt;
		if (typeof prompt !== "string" || prompt.length === 0) {
			throw new Error("a model effect needs a prompt, and this one has none");
		}

		const result = await controlPlane.invokeModel({
			capabilityId: effect.capabilityId,
			holder,
			// The target of a model effect is the class being asked for.
			modelClass: effect.target as ModelClass,
			prompt,
		});

		// Everything here lands in the Outcome, which is the point: the log says
		// which model answered, what it cost and how long it took, so the
		// abstract grant stays abstract without the record going vague.
		return {
			text: result.text,
			model: result.model,
			cost: result.cost,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
			durationMs: result.durationMs,
		};
	};
}
