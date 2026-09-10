/**
 * The operator's own files. `ENVIRONMENT_PLAN` slice 9, governed by `ADR-011`.
 *
 * **This is the human's filesystem access and it shares no code with a worker's.**
 * `ADR-003` §3.2 is explicit: a human surface having access to a path never
 * confers that access on a worker, they are separate modules with separate call
 * sites, and there is no shared path-resolution helper, because a shared
 * resolver is where the scope check eventually gets skipped. That module is
 * `packages/worker/src/filesystem.ts` and nothing here imports it or is imported
 * by it.
 *
 * A worker's file access is a capability: granted, scoped, checked at use,
 * recorded and revocable. A person's file access is a person opening their own
 * files. Those are different things and this file is the second one.
 *
 * **Maschina hosts the tree, it does not own it.** `ADR-011` §3: the working tree
 * stays a real directory, openable in any other editor at the same time, with
 * plain git history. Nothing here writes metadata, an index, a lockfile or a
 * sidecar of any kind. Delete Maschina and the directory is exactly as it was.
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { dialog } from "electron";

/** Directories nobody wants to look at, and one nobody should be editing by hand. */
const SKIP = new Set([".git", "node_modules", ".turbo", "out", "dist", ".DS_Store"]);

/** Above this, a file is not something a person is reading in a panel. */
const TOO_BIG = 2_000_000;

export interface Entry {
	readonly name: string;
	/** Relative to the opened root, so nothing outside it is even expressible. */
	readonly path: string;
	readonly directory: boolean;
}

export interface Result<T> {
	readonly ok: boolean;
	readonly value?: T;
	readonly problem?: string;
}

/** The directory a person opened. Nothing outside it is readable through here. */
let root: string | null = null;

export function opened(): string | null {
	return root;
}

/** Ask for a directory. A person chooses; nothing is opened on their behalf. */
export async function open(): Promise<Result<{ root: string; name: string }>> {
	const picked = await dialog.showOpenDialog({
		properties: ["openDirectory"],
		message: "Open a project",
	});
	if (picked.canceled || picked.filePaths[0] === undefined) {
		return { ok: false, problem: "Nothing was opened." };
	}
	root = resolve(picked.filePaths[0]);
	return { ok: true, value: { root, name: basename(root) } };
}

/**
 * Everything under one directory, one level deep.
 *
 * One level at a time rather than the whole tree, because a repository can hold
 * a hundred thousand files and a panel needs the twenty somebody is looking at.
 */
export async function list(within = ""): Promise<Result<Entry[]>> {
	const here = inside(within);
	if (here === null) return { ok: false, problem: "That path is outside the open project." };

	try {
		const entries = await readdir(here, { withFileTypes: true });
		const listed = entries
			.filter((e) => !SKIP.has(e.name))
			.map((e) => ({
				name: e.name,
				path: relative(root ?? "", join(here, e.name)),
				directory: e.isDirectory(),
			}))
			.sort((a, b) =>
				a.directory === b.directory ? a.name.localeCompare(b.name) : a.directory ? -1 : 1,
			);
		return { ok: true, value: listed };
	} catch (error: unknown) {
		return { ok: false, problem: error instanceof Error ? error.message : String(error) };
	}
}

export async function read(path: string): Promise<Result<{ text: string; path: string }>> {
	const file = inside(path);
	if (file === null) return { ok: false, problem: "That path is outside the open project." };

	try {
		const info = await stat(file);
		if (info.size > TOO_BIG) {
			return { ok: false, problem: `That file is ${Math.round(info.size / 1_000_000)}MB.` };
		}
		return { ok: true, value: { text: await readFile(file, "utf8"), path } };
	} catch (error: unknown) {
		return { ok: false, problem: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Save a file, in place.
 *
 * Straight to the real path, with no copy, no backup and no sidecar. Whatever is
 * watching that directory, another editor or a build, sees the change the way it
 * would see any other.
 */
export async function write(path: string, text: string): Promise<Result<{ path: string }>> {
	const file = inside(path);
	if (file === null) return { ok: false, problem: "That path is outside the open project." };

	try {
		await writeFile(file, text, "utf8");
		return { ok: true, value: { path } };
	} catch (error: unknown) {
		return { ok: false, problem: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Resolve a path inside the open directory, or refuse.
 *
 * The renderer sends relative paths and this is the only place they become
 * absolute. `..` and an absolute path both resolve out of the root and are
 * refused by comparing the resolved result rather than by inspecting the string,
 * because inspecting strings is how traversal defences get bypassed.
 */
function inside(path: string): string | null {
	if (root === null) return null;
	const target = resolve(root, path);
	if (target !== root && !target.startsWith(root + sep)) return null;
	return target;
}
