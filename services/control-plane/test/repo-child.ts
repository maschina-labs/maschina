/**
 * A node that makes a commit and dies at a chosen moment.
 *
 * Spawned by the slice 6 proof in three modes:
 *
 *   after   the push lands, then the process dies before recording the Outcome.
 *           Recovery must ask the remote, find the commit, and record what
 *           happened rather than pushing a second one.
 *   before  the process dies before the push. Recovery must ask the remote,
 *           find nothing, and re-execute.
 *   clean   no crash, for the ordinary case.
 *
 * **Started without the credential.** The proof strips `SSH_AUTH_SOCK` from this
 * process's environment, so a worker that tried to reach the remote itself would
 * find nothing to reach it with. `05-CAPABILITIES` §5 enforced by absence.
 */

import type { Executor } from "@maschina/worker";
import { httpControlPlane, performEffect, repositoryExecutor } from "@maschina/worker";

const [baseUrl, mode, worker, capabilityId, repository, branch, intentTag] =
	process.argv.slice(2);
if (!baseUrl || !mode || !worker || !capabilityId || !repository || !branch || !intentTag) {
	throw new Error("usage: repo-child <base> <mode> <worker> <cap> <repo> <branch> <tag>");
}

const plane = httpControlPlane(baseUrl);
const broker = repositoryExecutor(plane, worker);

// Proof that the credential is not here. Reported rather than assumed, so the
// proof checks the node's own view of its environment rather than trusting the
// spawn arguments.
console.log(`[${mode}] SSH_AUTH_SOCK=${process.env.SSH_AUTH_SOCK ?? "(absent)"}`);

const executor: Executor = async (effect) => {
	if (mode === "before") {
		// Dead before anything reaches the remote.
		process.kill(process.pid, "SIGKILL");
	}
	const result = await broker(effect);
	console.log(`[${mode}] pushed ${String(result.commit).slice(0, 7)}`);
	if (mode === "after") {
		// The commit is on the remote. The Outcome never gets written.
		process.kill(process.pid, "SIGKILL");
	}
	return result;
};

await performEffect(
	plane,
	{ worker, objective: "obj_slice6", reasoning: `repository effect, mode ${mode}` },
	{
		capabilityId,
		operation: "commit",
		target: repository,
		payload: {
			branch,
			path: "worker-output.txt",
			content: `written under bounded authority, ${intentTag}\n`,
			intentId: intentTag,
		},
	},
	"reconcilable",
	executor,
);
console.log(`[${mode}] complete`);
