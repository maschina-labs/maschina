/**
 * Reading a repository's history, for context assembly.
 *
 * A worker cannot answer "what convention does this repository use" without
 * looking, and looking is an effect like any other: it happens on this side of
 * the boundary, through the broker, because the worker holds no credential.
 *
 * Read only. There is no path from here to a write.
 */

import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** The last `count` commit subjects on the default branch. */
export async function recentSubjects(repository: string, count: number): Promise<string[]> {
	const workspace = mkdtempSync(join(tmpdir(), "maschina-history-"));
	try {
		await run(
			"git",
			["clone", "--depth", String(count + 5), `git@github.com:${repository}.git`, workspace],
			{ maxBuffer: 8 * 1024 * 1024 },
		);
		const { stdout } = await run("git", [
			"-C",
			workspace,
			"log",
			"--format=%s",
			"-n",
			String(count),
		]);
		return stdout.split("\n").filter((line) => line.trim().length > 0);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
}

/** Whether a path exists on a branch, asked of the remote rather than of a worker. */
export async function fileExistsOnRemote(
	repository: string,
	branch: string,
	path: string,
): Promise<boolean> {
	const workspace = mkdtempSync(join(tmpdir(), "maschina-exists-"));
	try {
		await run(
			"git",
			[
				"clone",
				"--depth",
				"1",
				"--branch",
				branch,
				`git@github.com:${repository}.git`,
				workspace,
			],
			{ maxBuffer: 8 * 1024 * 1024 },
		);
		const { stdout } = await run("git", ["-C", workspace, "ls-files", path]);
		return stdout.trim().length > 0;
	} catch {
		return false;
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
}

/** The contents of a file on a branch, read from the remote. */
export async function fileOnRemote(
	repository: string,
	branch: string,
	path: string,
): Promise<string | null> {
	const workspace = mkdtempSync(join(tmpdir(), "maschina-read-"));
	try {
		await run(
			"git",
			[
				"clone",
				"--depth",
				"1",
				"--branch",
				branch,
				`git@github.com:${repository}.git`,
				workspace,
			],
			{ maxBuffer: 8 * 1024 * 1024 },
		);
		const { stdout } = await run("git", ["-C", workspace, "show", `HEAD:${path}`], {
			maxBuffer: 8 * 1024 * 1024,
		});
		return stdout;
	} catch {
		return null;
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
}
