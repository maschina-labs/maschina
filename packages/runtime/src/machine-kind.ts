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
import type { TriggerDirection } from "./price-trigger.ts";

/**
 * A price this machine is waiting on.
 *
 * A machine only wakes when it has a run, so it cannot watch a price itself. It says here what it is
 * waiting for, and the orchestrator watches on its behalf. A machine may be waiting on several at once:
 * a range machine waits on the edge it buys at and the edge it sells at, and either can come first.
 */
export type WatchedLevel = {
	/**
	 * Names this level within the machine. It goes in the run's occurrence key and tells the machine
	 * which level woke it, so two levels never share a crossing or a run.
	 */
	id: string;
	/**
	 * The token whose price this level is about, which is not always the one being bought. Selling SOL
	 * for dollars and buying SOL with dollars are the same level watched from opposite sides, and in
	 * both cases the price that moves is SOL's.
	 */
	pricedMint: string;
	/** The price to act at, in micro-dollars. */
	level: BaseUnits;
	direction: TriggerDirection;
	/** How far clear of the level the price must go before this level can fire again. */
	hysteresisBps: number;
	/** The least time between two runs from this level. */
	minGapMs: number;
};

/** What a machine can see when it decides. Everything is given; nothing is fetched. */
export type MachineView = {
	/** The machine's own wallet balances, by mint, in that token's smallest unit. */
	balances: ReadonlyMap<string, BaseUnits>;
	/** What the machine may still spend, from its budget. */
	availableBudget: BaseUnits;
	/** The moment this run is for, not the moment the code happens to run. */
	now: Date;
	/**
	 * The level that woke this run, by the id the kind gave it, when a level did.
	 *
	 * A machine watching one level can infer this. A machine watching two cannot: by the time it runs,
	 * the price may have moved back inside the band, and acting on where the price is now rather than on
	 * which edge fired is how a range machine buys its own sell.
	 */
	wokeOn?: string;
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
	/**
	 * The token this machine's budget is counted in, which is whatever it spends.
	 *
	 * The budget is a limit on how much of an owner's money may be deployed at once, so money coming
	 * back in this token returns to the budget. A kind that never sells anything back can leave this
	 * out, and its budget will only ever fall.
	 */
	budgetMint?(settings: Settings): string;
	/**
	 * The prices this machine is waiting on, if any.
	 *
	 * Left out by a kind that runs on a schedule rather than on the market. The orchestrator asks the
	 * kind rather than reading settings itself, so adding a kind that waits on prices never means
	 * editing the watcher.
	 */
	levels?(settings: Settings): readonly WatchedLevel[];
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

/**
 * The token a machine's budget is counted in, or nothing when its kind does not say.
 *
 * Asked of the kind rather than guessed, because only a kind knows which side of its own trade is the
 * money and which is the thing being bought.
 */
export function budgetMintOf(
	kinds: MachineKindRegistry,
	kind: string,
	settings: unknown,
): string | undefined {
	const known = kinds.get(kind);
	if (!known?.budgetMint) return undefined;
	const read = known.readSettings(settings);
	return read.ok ? known.budgetMint(read.value) : undefined;
}

/**
 * Every price level a machine is waiting on, or nothing.
 *
 * Nothing is the answer for a kind that waits on no price, a kind nobody registered, and settings that
 * cannot be read. That last one matters: a level guessed from half-read settings would queue runs the
 * owner never asked for, and a run is the thing that leads to a trade.
 */
export function levelsOf(
	kinds: MachineKindRegistry,
	kind: string,
	settings: unknown,
): readonly WatchedLevel[] {
	const known = kinds.get(kind);
	if (!known?.levels) return [];
	const read = known.readSettings(settings);
	if (!read.ok) return [];

	const levels = known.levels(read.value);
	const names = new Set<string>();
	for (const level of levels) {
		if (names.has(level.id)) {
			throw new Error(`two levels of a ${kind} machine are both called ${level.id}`);
		}
		names.add(level.id);
	}
	return levels;
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
