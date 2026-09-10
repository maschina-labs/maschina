/**
 * Where the control plane is.
 *
 * `pnpm dev` starts a control plane and the window together, so the window could
 * assume `127.0.0.1:8787` and be right every time. A packaged application is only
 * the window. It opened, assumed the same address, found nothing there, and told
 * the operator that nothing was listening at a port they had never chosen. The
 * message was true and useless.
 *
 * So the address is a thing a person sets, kept per machine, and read back with
 * where it came from. `06-NODES` and Stage 2 need this anyway: the control plane
 * is not promised to be on this machine.
 *
 * **Not a silent default.** Unset is its own answer, distinct from set and
 * unreachable, because they have different fixes. `SUGGESTED` exists so the
 * common case is one click rather than typing, which is not the same as choosing
 * on somebody's behalf.
 *
 * This module holds the only `electron` import on this path. `control-plane.ts`
 * stays free of it so the proofs can import it in plain Node.
 */

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import { tidy, validate } from "./address-format.ts";

export { SUGGESTED, validate } from "./address-format.ts";

export interface Where {
	/** Null when nothing is set. Not a default standing in for one. */
	readonly url: string | null;
	/**
	 * `override` is `MASCHINA_CONTROL_PLANE_URL`, which `pnpm dev` sets and which
	 * always wins. `saved` is what a person chose. `unset` is neither.
	 */
	readonly source: "override" | "saved" | "unset";
	/** Set when something was saved but could not be read back. */
	readonly trouble?: string;
}

interface Settings {
	controlPlane?: string;
}

function file(): string {
	return join(app.getPath("userData"), "settings.json");
}

function readSettings(): { settings: Settings; trouble?: string } {
	try {
		return { settings: JSON.parse(readFileSync(file(), "utf8")) as Settings };
	} catch (error: unknown) {
		const code = (error as NodeJS.ErrnoException).code;
		// Never having saved anything is the normal first run, not a problem.
		if (code === "ENOENT") return { settings: {} };
		return {
			settings: {},
			trouble: `The saved address could not be read from ${file()}, so nothing is set.`,
		};
	}
}

/** Where the control plane is, and why it is there. */
export function where(): Where {
	const override = process.env.MASCHINA_CONTROL_PLANE_URL;
	if (override !== undefined && override !== "") {
		return { url: tidy(override), source: "override" };
	}

	const { settings, trouble } = readSettings();
	const saved = settings.controlPlane;
	if (typeof saved === "string" && validate(saved) === null) {
		return { url: tidy(saved), source: "saved" };
	}
	// Something is in the file but it is not an address. Say so rather than
	// behaving as though the person never set one.
	if (saved !== undefined && trouble === undefined) {
		return {
			url: null,
			source: "unset",
			trouble: "The saved address is not a valid address, so nothing is set.",
		};
	}
	return trouble === undefined
		? { url: null, source: "unset" }
		: { url: null, source: "unset", trouble };
}

export type Saved =
	| { readonly ok: true; readonly value: Where }
	| { readonly ok: false; readonly problem: string };

/**
 * Remember this address.
 *
 * Written to a temporary file and renamed, so losing power halfway through
 * leaves the previous address rather than half of a new one.
 */
export function save(input: string): Saved {
	const problem = validate(input);
	if (problem !== null) return { ok: false, problem };

	const url = tidy(input);
	const target = file();
	const temporary = `${target}.writing`;
	try {
		mkdirSync(dirname(target), { recursive: true });
		const { settings } = readSettings();
		writeFileSync(
			temporary,
			`${JSON.stringify({ ...settings, controlPlane: url }, null, "\t")}\n`,
		);
		renameSync(temporary, target);
	} catch (error: unknown) {
		try {
			unlinkSync(temporary);
		} catch {
			// Nothing to clean up, which is fine. The rename is what mattered.
		}
		return {
			ok: false,
			problem: `The address could not be saved: ${(error as Error).message}`,
		};
	}

	// The override still wins if one is set, and saying otherwise would be a lie
	// about which address is actually in use.
	return { ok: true, value: where() };
}

/** Forget the saved address. Leaves any override alone, because it is not ours. */
export function forget(): Saved {
	const target = file();
	try {
		const { settings } = readSettings();
		delete settings.controlPlane;
		writeFileSync(target, `${JSON.stringify(settings, null, "\t")}\n`);
	} catch (error: unknown) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code !== "ENOENT") {
			return {
				ok: false,
				problem: `The address could not be forgotten: ${(error as Error).message}`,
			};
		}
	}
	return { ok: true, value: where() };
}
