/**
 * What every machine kind is, and the only thing the runtime knows about them.
 *
 * A kind is data plus one decide function. It reads its settings and what it can see of the world, and
 * says what it would like to do. It never signs, sends, writes to the record or reads a clock: it is
 * given everything it needs and returns a decision.
 *
 * Nothing in the runtime branches on which kind a machine is. Adding a new kind means adding a module
 * here, not editing the loop, and an architecture rule keeps it that way.
 *
 * A decision is one of three things:
 *
 *   act   do this, for this reason
 *   wait  nothing to do yet, for this reason
 *   stop  this machine's job is finished
 */

import type { BaseUnits } from "@maschina/core";

/** What a machine can see when it decides. Everything is given; nothing is fetched. */
export type MachineView = {
	/** The machine's own wallet balances, by mint, in that token's smallest unit. */
	balances: ReadonlyMap<string, BaseUnits>;
	/** What the machine may still spend, from its budget. */
	availableBudget: BaseUnits;
	/** The moment this run is for, not the moment the code happens to run. */
	now: Date;
	/** What this machine has already done, as totals it needs to decide. */
	totals: { spent: BaseUnits; buys: number };
};

export type SwapAction = {
	do: "swap";
	/** What is being spent. */
	inputMint: string;
	/** What is being bought. */
	outputMint: string;
	/** How much of the input to spend, in its smallest unit. */
	inputAmount: BaseUnits;
	/** How far the price may move before the trade is refused, in hundredths of a percent. */
	slippageBps: number;
};

/** Every action a machine kind may propose. One for now; more arrive with the other kinds. */
export type ProposedAction = SwapAction;

export type Decision =
	| { decide: "act"; action: ProposedAction; because: string }
	| { decide: "wait"; because: WaitReason; detail?: string }
	| { decide: "stop"; because: string };

/** Why a machine chose to do nothing. These become `run.skipped` reasons in the record. */
export type WaitReason =
	| "not_due"
	| "balance_too_low"
	| "budget_exhausted"
	| "limit_reached"
	| "market_conditions";

/**
 * A machine kind: its name, how to read its settings, and how it decides.
 *
 * `settings` are checked before they reach `decide`, so a kind never has to defend itself against a
 * malformed recipe.
 */
export type MachineKind<Settings> = {
	readonly kind: string;
	/** Checks a recipe's settings, or says what is wrong with them. */
	readSettings(settings: unknown): { ok: true; value: Settings } | { ok: false; problem: string };
	/** Decides what to do. Pure: the same settings and view always give the same decision. */
	decide(settings: Settings, view: MachineView): Decision;
};

/** The kinds a running Maschina knows about, by name. */
export type MachineKindRegistry = ReadonlyMap<string, MachineKind<unknown>>;

export function registryOf(kinds: readonly MachineKind<never>[]): MachineKindRegistry {
	const byName = new Map<string, MachineKind<unknown>>();
	for (const kind of kinds) {
		if (byName.has(kind.kind)) {
			throw new Error(`two machine kinds are both called ${kind.kind}`);
		}
		byName.set(kind.kind, kind as MachineKind<unknown>);
	}
	return byName;
}

/** Reads settings and decides in one step, so callers never hold half-checked settings. */
export function decideFor(
	kind: MachineKind<unknown>,
	settings: unknown,
	view: MachineView,
): Decision {
	const read = kind.readSettings(settings);
	if (!read.ok) {
		return { decide: "wait", because: "market_conditions", detail: read.problem };
	}
	return kind.decide(read.value, view);
}
