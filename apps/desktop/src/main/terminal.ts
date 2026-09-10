/**
 * The operator's own shell. `ENVIRONMENT_PLAN` slice 10.
 *
 * **This is not where workers execute, and it never will be.** `ADR-003` §3.1 is
 * the one constraint in that record marked as not reopening:
 *
 *   "The human terminal and the worker execution path are different mechanisms.
 *    They do not share a code path."
 *
 * The reason is worth restating rather than assuming. An Electron main process
 * with a pseudoterminal attached to somebody's real zsh has no isolation
 * boundary at all. It holds their credentials, SSH keys, npm tokens, cloud
 * configuration and entire filesystem. If workers executed through this layer,
 * every worker would inherit ambient authority over the whole machine and
 * `01-PRINCIPLES` P1 would be defeated at the foundation: the capability system
 * would become a display of permissions while real authority came from the
 * process hosting it.
 *
 * So a worker's shell is a different thing entirely, bounded by an isolation
 * boundary on a node (`05-CAPABILITIES` §7, `06-NODES` §5), holding no
 * credentials, recorded as Intent and Outcome, and revocable in one action.
 *
 * `ADR-003` §3.1 also says what that means in code, and this file obeys it:
 * these must not be one invocation distinguished by a flag, because a flag will
 * eventually be passed wrong. Nothing here is imported by `@maschina/worker` and
 * nothing here imports it.
 *
 * Unbounded by design. This is the operator's machine, and a terminal that
 * refused to run their own commands would be a worse terminal, not a safer one.
 */

import { homedir } from "node:os";
import type { IPty } from "node-pty";
import { spawn } from "node-pty";

/** What a shell needs to render properly. */
const TERM = "xterm-256color";

export interface Session {
	readonly id: string;
	readonly pty: IPty;
}

const open = new Map<string, IPty>();

/**
 * Start a shell.
 *
 * Their login shell, so their profile, aliases, prompt and PATH are all there.
 * A terminal that starts a different shell than the one somebody uses is a
 * terminal that behaves differently from every other one on the machine.
 */
export function start(
	id: string,
	cwd: string | null,
	onData: (chunk: string) => void,
	onExit: (code: number) => void,
): { ok: boolean; problem?: string } {
	if (open.has(id)) return { ok: true };

	try {
		const shell = process.env.SHELL ?? "/bin/zsh";
		const pty = spawn(shell, ["-l"], {
			name: TERM,
			cols: 80,
			rows: 24,
			cwd: cwd ?? homedir(),
			env: { ...process.env, TERM },
		});

		pty.onData(onData);
		pty.onExit(({ exitCode }) => {
			open.delete(id);
			onExit(exitCode);
		});

		open.set(id, pty);
		return { ok: true };
	} catch (error: unknown) {
		// A terminal that fails to start silently looks like a terminal where
		// nothing is happening, and those are different problems.
		return {
			ok: false,
			problem: error instanceof Error ? error.message : String(error),
		};
	}
}

export function write(id: string, data: string): void {
	open.get(id)?.write(data);
}

/**
 * Tell the shell the window changed size.
 *
 * Without this, anything that draws its own interface, an editor, a pager, or
 * something with a progress bar, draws at the wrong width and looks broken.
 */
export function resize(id: string, cols: number, rows: number): void {
	try {
		open.get(id)?.resize(Math.max(1, cols), Math.max(1, rows));
	} catch {
		// The shell exited between the resize arriving and being applied. There is
		// nothing to resize and nothing worth saying.
	}
}

export function stop(id: string): void {
	const pty = open.get(id);
	if (pty === undefined) return;
	open.delete(id);
	try {
		pty.kill();
	} catch {
		// Already gone.
	}
}

/** Close everything. Called when the window goes, so no shell outlives it. */
export function stopAll(): void {
	for (const id of [...open.keys()]) stop(id);
}
