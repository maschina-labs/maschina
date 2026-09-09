/**
 * The filesystem executor. Effect class 1, idempotent.
 *
 * Writing a file with fixed content is naturally idempotent: doing it twice
 * leaves the world in the same state as doing it once, which is what makes
 * recovery from a crash between Intent and Outcome a re-execution rather than a
 * question (`03-RUNTIME` §3).
 *
 * **This executor performs no authority check, and it is not supposed to.** It
 * runs only after `performEffect` has authorized the operation and durably
 * recorded the Intent. Re-checking the scope here would be the same check, in
 * the same process, from the same data, and two places that decide is how the
 * two eventually disagree.
 *
 * **It does defend against something the scope check cannot.** `withinScope` is
 * pure: it compares strings and knows nothing about what is on disk. A symlink
 * sitting at the target path is inside the scope as a string and points wherever
 * it likes, so following it writes outside the capability's bounds without the
 * authority check ever being wrong. That is a fact about the filesystem at the
 * moment of the write, so it can only be defended at the moment of the write.
 * Hence `O_NOFOLLOW` below. The two checks are not duplicates; they defend
 * different things.
 */

import { constants, mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import type { Executor } from "./effect.ts";

/**
 * Owner read and write only.
 *
 * A sandbox often lives in a shared directory, and a file created with the
 * default umask there is readable by every other account on the machine. A
 * worker's output is not public by default.
 */
const OWNER_ONLY = 0o600;

export const filesystemExecutor: Executor = async (effect) => {
	if (effect.operation !== "write" && effect.operation !== "create") {
		throw new Error(`filesystem executor cannot perform ${effect.operation}`);
	}

	const content = effect.payload.content;
	if (typeof content !== "string") {
		throw new Error("a filesystem write needs string content");
	}

	await mkdir(dirname(effect.target), { recursive: true });

	// O_NOFOLLOW makes the kernel refuse if the final path component is a
	// symlink, rather than following it out of the scope. O_CREAT and O_TRUNC
	// give ordinary overwrite semantics.
	//
	// Honest limit: this protects the final component only. A symlinked parent
	// directory still redirects the write, and closing that needs openat() per
	// component, which Node does not expose. The containment for that case is
	// the isolation boundary (`06-NODES` §5), which is what bounds a shell too.
	let handle: Awaited<ReturnType<typeof open>>;
	try {
		handle = await open(
			effect.target,
			constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
			OWNER_ONLY,
		);
	} catch (error: unknown) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === "ELOOP") {
			// Not a generic I/O failure. Someone put a symlink where a worker was
			// about to write, which is an attempt to escape the scope, and it
			// should read that way in the log rather than as a disk problem.
			throw new Error(
				`refused: ${effect.target} is a symlink, and following it would write outside the capability's scope`,
			);
		}
		throw error;
	}

	try {
		await handle.writeFile(content, "utf8");
		return { bytesWritten: Buffer.byteLength(content, "utf8"), path: effect.target };
	} finally {
		await handle.close();
	}
};
