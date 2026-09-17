import { readFileSync } from "node:fs";

/**
 * Reads and parses a JSON file, or returns undefined if it doesn't exist. Reading in one step, instead
 * of checking first, means the file can't change between the check and the read.
 */
export function readJsonIfPresent(path: string): unknown {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
		throw error;
	}
	return JSON.parse(text);
}
