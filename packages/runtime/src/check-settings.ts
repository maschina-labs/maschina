/**
 * Whether a machine can work at all, checked before it is made.
 *
 * Before this, a machine's settings were first read by the node running it. A kind nobody built, a band
 * too narrow to cover its own costs, or a budget in a token the owner never approved would all be
 * accepted, given a wallet, funded, and then fail on every run with the money sitting idle and nobody
 * told why. Every one of those is knowable before a wallet exists, so it is asked then.
 *
 * The kind does the reading, the same function the node uses, so a machine that passes here is a
 * machine the node can read.
 */

import type { MachineKindRegistry } from "./machine-kind.ts";

export type SettingsCheck = { ok: true } | { ok: false; problem: string };

export function checkMachineSettings(
	kinds: MachineKindRegistry,
	machine: { kind: string; settings: unknown; approvedMints: readonly string[] },
): SettingsCheck {
	const kind = kinds.get(machine.kind);
	if (!kind) return { ok: false, problem: `there is no kind of machine called ${machine.kind}` };

	const read = kind.readSettings(machine.settings);
	if (!read.ok) return { ok: false, problem: read.problem };

	const approved = new Set(machine.approvedMints);
	const budgetMint = kind.budgetMint?.(read.value);
	if (budgetMint !== undefined && !approved.has(budgetMint)) {
		return {
			ok: false,
			problem: "this machine spends a token that is not approved, so every trade would be refused",
		};
	}
	for (const level of kind.levels?.(read.value) ?? []) {
		if (!approved.has(level.pricedMint)) {
			return {
				ok: false,
				problem:
					"this machine trades a token that is not approved, so every trade would be refused",
			};
		}
	}
	return { ok: true };
}
