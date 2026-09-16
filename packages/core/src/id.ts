/**
 * Identifiers are UUIDv7: unique, and sortable by creation time, which keeps the record and its
 * indexes in order. Each kind of thing gets its own type, so a machine id can't be passed where a
 * run id is expected.
 */

import { uuidv7 } from "uuidv7";
import { MaschinaError } from "./errors.ts";

declare const idKind: unique symbol;

export type Id<Kind extends string> = string & { readonly [idKind]: Kind };

export type OwnerId = Id<"owner">;
export type MachineId = Id<"machine">;
export type RunId = Id<"run">;
export type EventId = Id<"event">;
export type NodeId = Id<"node">;

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function newId<Kind extends string>(): Id<Kind> {
	return uuidv7() as Id<Kind>;
}

/** Checks untrusted input is a well-formed id before it is used as one. */
export function parseId<Kind extends string>(value: string, kind: Kind): Id<Kind> {
	if (!UUID_V7.test(value)) {
		throw new MaschinaError("invalid_input", `not a valid ${kind} id`, { details: { kind } });
	}
	return value as Id<Kind>;
}
