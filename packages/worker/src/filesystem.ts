/**
 * The filesystem executor. Effect class 1, idempotent.
 *
 * Writing a file with fixed content is naturally idempotent: doing it twice
 * leaves the world in the same state as doing it once, which is what makes
 * recovery from a crash between Intent and Outcome a re-execution rather than a
 * question (`03-RUNTIME` §3).
 *
 * **This executor performs no authority check.** It runs only after
 * `performEffect` has authorized the operation and durably recorded the Intent.
 * Putting a scope check here as well would be defence in depth in appearance
 * only: it would be the same check, in the same process, from the same data, and
 * having two places that decide is how the two eventually disagree. The real
 * second layer is the isolation boundary (`06-NODES` §5), which is a different
 * mechanism in a different place.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Executor } from "./effect.ts";

export const filesystemExecutor: Executor = async (effect) => {
	if (effect.operation !== "write" && effect.operation !== "create") {
		throw new Error(`filesystem executor cannot perform ${effect.operation}`);
	}

	const content = effect.payload.content;
	if (typeof content !== "string") {
		throw new Error("a filesystem write needs string content");
	}

	await mkdir(dirname(effect.target), { recursive: true });
	await writeFile(effect.target, content, "utf8");

	return { bytesWritten: Buffer.byteLength(content, "utf8"), path: effect.target };
};
