/**
 * Content addressing: the same content always gets the same id.
 *
 * A machine's definition is identified by what it says, not by when it was saved. Two owners writing
 * the same recipe get the same id, and changing a recipe makes a new id rather than editing the old
 * one, so a running machine can be pinned to exactly what it started with.
 *
 * Keys are sorted, so the same object written in a different order is the same content. Anything that
 * can't be compared this way (a function, undefined, a cycle) is refused rather than silently ignored.
 */

import { createHash } from "node:crypto";
import { MaschinaError } from "./errors.ts";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** JSON with object keys in a fixed order, so equal content produces equal text. */
export function canonicalJson(value: unknown, path = "$"): string {
	if (value === null) return "null";
	switch (typeof value) {
		case "boolean":
			return value ? "true" : "false";
		case "number":
			if (!Number.isFinite(value)) {
				throw new MaschinaError("invalid_input", `${path} is not a finite number`);
			}
			return JSON.stringify(value);
		case "string":
			return JSON.stringify(value);
		case "bigint":
			// A bigint has no JSON form, and quietly turning it into a string would change the id.
			throw new MaschinaError("invalid_input", `${path} is a bigint; write it as a string first`);
		default:
			break;
	}
	if (Array.isArray(value)) {
		return `[${value.map((item, index) => canonicalJson(item, `${path}[${index}]`)).join(",")}]`;
	}
	if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>).filter(
			([, item]) => item !== undefined,
		);
		entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		const parts = entries.map(
			([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item, `${path}.${key}`)}`,
		);
		return `{${parts.join(",")}}`;
	}
	throw new MaschinaError("invalid_input", `${path} can't be stored as content`);
}

/** The content's id: the SHA-256 of its canonical form, as 64 hex characters. */
export function contentId(value: unknown): string {
	return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
