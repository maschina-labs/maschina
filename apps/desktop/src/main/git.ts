/**
 * The operator's git. `ENVIRONMENT_PLAN` slice 11.
 *
 * **This is a person running git on their own repository.** It is not the
 * repository capability, which is how a worker commits: brokered so the worker
 * never sees a credential, recorded as Intent and Outcome, scoped to a repo and
 * a branch pattern, and revocable in one action (`05-CAPABILITIES` §5,
 * `packages/worker/src/repository.ts`).
 *
 * Those are different things for the same reason the terminal and the filesystem
 * are: a human surface having access never confers that access on a worker
 * (`ADR-003` §3.2). Separate module, separate call sites, nothing shared.
 *
 * **Maschina does not become git.** `08-ENVIRONMENT` §2 lists git as never
 * replaced, and `ADR-011` did not reverse that row. This runs the real `git`
 * binary against the real repository, so the history it produces is
 * indistinguishable from history made in any other terminal, and everything else
 * on that directory keeps working.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Long enough for a push over a slow connection, short enough to not hang forever. */
const TIMEOUT_MS = 60_000;

export interface Result<T> {
	readonly ok: boolean;
	readonly value?: T;
	readonly problem?: string;
}

export interface Change {
	/** Two characters from `git status --porcelain`: staged, then unstaged. */
	readonly code: string;
	readonly path: string;
	readonly staged: boolean;
}

export interface Status {
	readonly branch: string;
	readonly upstream: string | null;
	readonly ahead: number;
	readonly behind: number;
	readonly changes: readonly Change[];
}

/**
 * Run git in a directory.
 *
 * Arguments are an array, never a string, so nothing is parsed by a shell and a
 * filename with a space or a semicolon in it is a filename rather than a second
 * command.
 */
async function git(cwd: string, args: readonly string[]): Promise<Result<string>> {
	try {
		const { stdout } = await run("git", [...args], {
			cwd,
			timeout: TIMEOUT_MS,
			maxBuffer: 16 * 1024 * 1024,
		});
		return { ok: true, value: stdout };
	} catch (error: unknown) {
		// git says useful things on stderr and this is a place a person is
		// reading, so pass it through rather than replacing it with a summary.
		const said = (error as { stderr?: string; message?: string }).stderr;
		return {
			ok: false,
			problem: (said ?? (error as Error).message ?? String(error)).trim(),
		};
	}
}

/** Is this a repository at all, and which branch is checked out. */
export async function status(cwd: string): Promise<Result<Status>> {
	const porcelain = await git(cwd, ["status", "--porcelain=v2", "--branch"]);
	if (!porcelain.ok) return { ok: false, problem: porcelain.problem ?? "git said nothing." };

	let branch = "";
	let upstream: string | null = null;
	let ahead = 0;
	let behind = 0;
	const changes: Change[] = [];

	for (const line of (porcelain.value ?? "").split("\n")) {
		if (line.startsWith("# branch.head ")) branch = line.slice(14).trim();
		else if (line.startsWith("# branch.upstream ")) upstream = line.slice(18).trim();
		else if (line.startsWith("# branch.ab ")) {
			const [plus, minus] = line.slice(12).trim().split(" ");
			ahead = Number(plus?.replace("+", "") ?? 0);
			behind = Math.abs(Number(minus ?? 0));
		} else if (line.startsWith("1 ") || line.startsWith("2 ")) {
			// `1 XY ...` is an ordinary change, `2 XY ...` a rename. The path is
			// the last field, and for a rename the new name comes first.
			const parts = line.split(" ");
			const code = parts[1] ?? "..";
			const path = line.slice(line.indexOf(parts[8] ?? "")).split("\t")[0] ?? "";
			changes.push({ code, path: path.trim(), staged: code[0] !== "." });
		} else if (line.startsWith("? ")) {
			changes.push({ code: "??", path: line.slice(2).trim(), staged: false });
		}
	}

	return { ok: true, value: { branch, upstream, ahead, behind, changes } };
}

/** What changed in one file, or in everything if no path is given. */
export async function diff(cwd: string, path?: string): Promise<Result<string>> {
	const args = ["diff", "--no-color", "HEAD", "--"];
	const result = await git(cwd, path === undefined ? args.slice(0, -1) : [...args, path]);
	return result.ok ? { ok: true, value: result.value ?? "" } : result;
}

export async function branches(cwd: string): Promise<Result<string[]>> {
	const result = await git(cwd, ["branch", "--format=%(refname:short)"]);
	if (!result.ok) return { ok: false, problem: result.problem ?? "git said nothing." };
	return {
		ok: true,
		value: (result.value ?? "")
			.split("\n")
			.map((b) => b.trim())
			.filter((b) => b !== ""),
	};
}

export async function stage(cwd: string, paths: readonly string[]): Promise<Result<null>> {
	if (paths.length === 0) return { ok: true, value: null };
	const result = await git(cwd, ["add", "--", ...paths]);
	return result.ok
		? { ok: true, value: null }
		: { ok: false, problem: result.problem ?? "git said nothing." };
}

export async function unstage(cwd: string, paths: readonly string[]): Promise<Result<null>> {
	if (paths.length === 0) return { ok: true, value: null };
	const result = await git(cwd, ["restore", "--staged", "--", ...paths]);
	return result.ok
		? { ok: true, value: null }
		: { ok: false, problem: result.problem ?? "git said nothing." };
}

/**
 * Commit what is staged.
 *
 * The message is passed as an argument rather than through a shell, and nothing
 * is added to it. Whatever a person writes is what the history says, which is
 * the whole reason a person is writing it.
 */
export async function commit(cwd: string, message: string): Promise<Result<string>> {
	if (message.trim() === "") {
		return { ok: false, problem: "A commit needs a message." };
	}
	const result = await git(cwd, ["commit", "-m", message]);
	return result.ok ? { ok: true, value: (result.value ?? "").trim() } : result;
}

/**
 * Push.
 *
 * Never with force, and there is no argument that could make it force. A
 * force-push destroys history that other people may be building on, and
 * `03-RUNTIME` §5 classes an unsafe effect as one that escalates rather than
 * being made easy. If somebody needs to force-push, they have a terminal.
 */
export async function push(cwd: string): Promise<Result<string>> {
	const result = await git(cwd, ["push"]);
	return result.ok ? { ok: true, value: (result.value ?? "").trim() } : result;
}
