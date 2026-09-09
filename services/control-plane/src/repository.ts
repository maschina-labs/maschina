/**
 * The repository effect, performed by the broker. `05-CAPABILITIES` §5.
 *
 * "Workers never hold credentials. The broker performs credentialed effects."
 *
 * A worker asks for a commit. It does not get a token, a key, an agent socket,
 * or a clone. It gets an answer. Everything in this file runs in the control
 * plane, and the node is spawned without the credential in its environment, so
 * the rule is enforced by the node not having the thing rather than by the node
 * choosing not to use it.
 *
 * **This is effect class `reconcilable`.** A push either landed or it did not,
 * and a crash in the middle leaves that genuinely unknown, but unlike an unsafe
 * effect the world can be asked. `reconcile` below asks it, by querying the
 * remote rather than trusting anything the executor reported, which is
 * invariant 17.
 */

import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface RepositoryEffect {
	/** `owner/name`. The capability's scope, and checked against it before this runs. */
	readonly repository: string;
	readonly branch: string;
	readonly path: string;
	readonly content: string;
	/**
	 * The Intent's id, written into the commit message.
	 *
	 * This is what makes the effect reconcilable rather than unsafe. After a
	 * crash the remote can be asked "is there a commit carrying this id", and the
	 * answer is definitive, from the world, without trusting any local record of
	 * what happened. Without a marker the only question available is "does the
	 * branch look roughly right", which is a guess.
	 */
	readonly intentId: string;
}

export interface RepositoryResult {
	readonly commit: string;
	readonly branch: string;
	readonly repository: string;
	readonly pushed: boolean;
}

export class RepositoryRefused extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RepositoryRefused";
	}
}

/** The marker a commit carries so the remote can be asked about it later. */
export function intentMarker(intentId: string): string {
	return `Maschina-Intent: ${intentId}`;
}

function remoteUrl(repository: string): string {
	return `git@github.com:${repository}.git`;
}

/**
 * Make the commit and push it.
 *
 * Clones shallow into a temporary directory each time. That is slower than
 * keeping a working copy, and it is the point: a persistent working tree is
 * exactly the unreconstructible node state `15-OPEN-QUESTIONS` C1 is about, and
 * Stage 0 has no reason to create one. When a worker genuinely needs a working
 * tree, its capability declares `checkpoint: "commit"` and this changes.
 */
export async function performRepositoryEffect(
	effect: RepositoryEffect,
): Promise<RepositoryResult> {
	const workspace = mkdtempSync(join(tmpdir(), "maschina-repo-"));
	const git = (...args: string[]) =>
		run("git", ["-C", workspace, ...args], { maxBuffer: 8 * 1024 * 1024 });

	try {
		// Clone the branch being written to, if it is already there. Cloning the
		// default branch and force-creating the target on top of it looks like it
		// works, and quietly discards every commit already on that branch: the
		// next push either fails its lease check or overwrites somebody's work.
		try {
			await run(
				"git",
				[
					"clone",
					"--depth",
					"1",
					"--branch",
					effect.branch,
					remoteUrl(effect.repository),
					workspace,
				],
				{ maxBuffer: 8 * 1024 * 1024 },
			);
		} catch {
			// The branch does not exist yet, which is not an error, it is the
			// first commit on it.
			await run("git", ["clone", "--depth", "1", remoteUrl(effect.repository), workspace], {
				maxBuffer: 8 * 1024 * 1024,
			});
			await git("checkout", "-B", effect.branch);
		}

		writeFileSync(join(workspace, effect.path), effect.content);
		await git("add", effect.path);
		await git(
			"-c",
			"user.name=Maschina",
			"-c",
			"user.email=maschina@localhost",
			"commit",
			"-m",
			`Write ${effect.path}\n\n${intentMarker(effect.intentId)}`,
		);

		const { stdout: sha } = await git("rev-parse", "HEAD");
		await git("push", "--force-with-lease", "origin", effect.branch);

		return {
			commit: sha.trim(),
			branch: effect.branch,
			repository: effect.repository,
			pushed: true,
		};
	} catch (cause: unknown) {
		throw new RepositoryRefused(cause instanceof Error ? cause.message : String(cause));
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
}

/**
 * Ask the remote whether the effect landed. `03-RUNTIME` §3.
 *
 * Called during recovery, when an Intent has no Outcome and nobody knows whether
 * the push happened. **It queries the git remote and does not trust any local
 * record**, which is invariant 17: mechanical criteria verify against world
 * state the executor does not control.
 *
 * Returns the commit if the effect landed, or null if it demonstrably did not.
 * Throws if the remote cannot be reached, because "I could not ask" is not the
 * same answer as "it did not happen", and P8 says ambiguity blocks rather than
 * resolving itself in whichever direction is convenient.
 */
export async function reconcile(
	repository: string,
	branch: string,
	intentId: string,
): Promise<string | null> {
	const workspace = mkdtempSync(join(tmpdir(), "maschina-reconcile-"));
	try {
		try {
			await run(
				"git",
				["clone", "--depth", "20", "--branch", branch, remoteUrl(repository), workspace],
				{ maxBuffer: 8 * 1024 * 1024 },
			);
		} catch (cause: unknown) {
			const message = cause instanceof Error ? cause.message : String(cause);
			// A branch that does not exist is a real answer: the push did not land.
			if (message.includes("Remote branch") || message.includes("not found")) return null;
			throw new RepositoryRefused(
				`could not ask the remote whether ${intentId} landed, so it stays unknown: ${message}`,
			);
		}

		const { stdout } = await run(
			"git",
			["-C", workspace, "log", "--format=%H%n%B%n--", "-n", "20"],
			{ maxBuffer: 8 * 1024 * 1024 },
		);

		const marker = intentMarker(intentId);
		for (const entry of stdout.split("\n--\n")) {
			if (entry.includes(marker)) {
				const sha = entry.trim().split("\n")[0];
				if (sha !== undefined) return sha;
			}
		}
		return null;
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
}
