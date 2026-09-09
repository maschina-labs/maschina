/**
 * Asking the broker for a commit.
 *
 * This is the whole of a worker's repository access. There is no clone here, no
 * remote URL, no token, no key, no agent socket. The worker describes what it
 * wants to exist and receives a commit hash, and it has no other route to a
 * remote (`05-CAPABILITIES` §5).
 *
 * The containment is not that this file avoids credentials. It is that the node
 * process is started without them, so a worker that tried would find nothing to
 * find. `lease.proof.ts` and the slice 6 proof both start nodes with the agent
 * socket stripped from the environment, and the proof greps for it.
 */

import type { ControlPlane } from "./control-plane.ts";
import type { Executor } from "./effect.ts";

/**
 * Build the executor for a worker's repository effects.
 *
 * The Intent id goes into the commit message, which is what makes this effect
 * reconcilable rather than unsafe: after a crash the remote can be asked whether
 * a commit carrying that id exists, and the answer comes from the world rather
 * than from anything this process claims to remember.
 */
export function repositoryExecutor(controlPlane: ControlPlane, holder: string): Executor {
	return async (effect) => {
		const branch = String(effect.payload.branch ?? "");
		const path = String(effect.payload.path ?? "");
		const intentId = String(effect.payload.intentId ?? "");
		if (branch === "" || path === "" || intentId === "") {
			throw new Error(
				"a repository effect needs a branch, a path, and the intent it belongs to",
			);
		}

		return (await controlPlane.commit({
			capabilityId: effect.capabilityId,
			holder,
			repository: effect.target,
			branch,
			path,
			content: String(effect.payload.content ?? ""),
			intentId,
		})) as unknown as Record<string, unknown>;
	};
}
