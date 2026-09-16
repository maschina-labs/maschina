/**
 * The shape of a machine kind, for developers building their own. A kind is data: the settings it
 * accepts, and a function that looks at the current state and proposes what to do. It never signs,
 * never writes the record and never widens its own limits. Maschina runs it inside the same rules as
 * every built-in machine.
 */

import { MaschinaError } from "@maschina/core";
import type { z } from "zod";

export type Proposal<Action> =
	| { kind: "act"; action: Action; reason: string }
	| { kind: "skip"; reason: string };

export type DecideInput<Settings, State> = {
	settings: Settings;
	state: State;
	now: Date;
};

export type MachineKind<Settings, State, Action> = {
	/** Stable identifier, such as "recurring-buy". Lowercase letters, numbers and dashes. */
	id: string;
	/** The plain label shown under a machine's name. */
	label: string;
	settings: z.ZodType<Settings>;
	decide: (input: DecideInput<Settings, State>) => Proposal<Action> | Promise<Proposal<Action>>;
};

const KIND_ID = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;

export function defineMachineKind<Settings, State, Action>(
	kind: MachineKind<Settings, State, Action>,
): Readonly<MachineKind<Settings, State, Action>> {
	if (!KIND_ID.test(kind.id)) {
		throw new MaschinaError("invalid_input", `"${kind.id}" is not a valid machine kind id`);
	}
	if (kind.label.trim().length === 0) {
		throw new MaschinaError("invalid_input", "a machine kind needs a label");
	}
	return Object.freeze({ ...kind });
}
