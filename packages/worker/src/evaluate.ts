/**
 * Recording a verdict, as an effect.
 *
 * `09-EVALUATION` §4: "Evaluation is done by a worker like any other. It is not
 * a special class." So this is an `Executor`, and judging goes through
 * authorize, Intent, execute, Outcome exactly like writing a file does.
 *
 * The first version of slice 7 called the database directly from the proof. It
 * passed, and it proved less than it read as: no Intent was recorded, the
 * `evaluate` capability was never actually used, and nothing crossed the node
 * boundary. The denials were real; the happy path was not.
 */

import type { Verdict } from "@maschina/core";
import type { ControlPlane } from "./control-plane.ts";
import type { Executor } from "./effect.ts";

export function evaluationExecutor(controlPlane: ControlPlane, holder: string): Executor {
	return async (effect) => {
		const verdicts = effect.payload.verdicts;
		const contractHash = effect.payload.contractHash;
		if (!Array.isArray(verdicts) || verdicts.length === 0) {
			throw new Error("a verdict names at least one criterion, and this one names none");
		}
		if (typeof contractHash !== "string" || contractHash.length === 0) {
			// Without it a verdict could be read against a contract it never
			// judged, which is the freeze defeated by filing rather than argument.
			throw new Error("a verdict must say which frozen contract it judged");
		}

		const result = await controlPlane.evaluate({
			capabilityId: effect.capabilityId,
			holder,
			// The target of an evaluation is the objective being judged.
			objective: effect.target,
			contractHash,
			verdicts: verdicts as Verdict[],
		});

		return { ...result };
	};
}
