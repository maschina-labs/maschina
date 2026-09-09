/**
 * Model providers, plural. `ADR-009`'s exit condition.
 *
 * Stage 0 had one provider: the Claude CLI on a subscription, hard-wired into
 * `model.ts`. That was the right call with one provider and it stops being right
 * the moment there are two, because the choice of who answers becomes a decision
 * somebody makes rather than a fact about the code.
 *
 * **A capability names a model class, never a provider** (`04-WORKERS` §7). Which
 * provider serves a class is configuration. That has been true since slice 4;
 * this makes the provider itself something with an identity, a quota, and a
 * state, rather than an implementation detail.
 *
 * **Falling back is an event, never a shrug.** `01-PRINCIPLES` forbids graceful
 * degradation that changes behaviour unrecorded, and answering with a different
 * model than the one asked for is exactly that. An objective may legitimately
 * require the class it asked for and nothing else, so a fallback happens only
 * when the capability permits it, and it is always in the log.
 */

import type { ModelClass } from "@maschina/core";

/** How a provider is reached, and what it costs to be wrong about it. */
export type ProviderKind =
	/** A CLI on this machine, authenticated by a subscription. No key, no bill. */
	| "subscription"
	/** An API key. Real money, per call. */
	| "api"
	/** A model running on this machine. No money, and no network. */
	| "local";

export interface Provider {
	readonly id: string;
	readonly kind: ProviderKind;
	/** Which classes this provider can answer, and with what. */
	readonly models: Partial<Record<ModelClass, string>>;
	/**
	 * Whether spending here costs money.
	 *
	 * Recorded because it changes what a budget means. A subscription's numbers
	 * are list value, what tokens are worth; an API key's are money. Treating
	 * them as the same unit would let a budget meant to cap a bill be silently
	 * spent against something that was never billed (`ADR-009` §3).
	 */
	readonly billed: boolean;
}

/** Why a provider is not answering right now. */
export type ProviderState =
	| { readonly available: true }
	/** Out of quota until a stated time. A clock fixes this. */
	| { readonly available: false; readonly reason: "quota"; readonly until: Date }
	/** Broken, missing, or unreachable. A person fixes this. */
	| { readonly available: false; readonly reason: "unavailable"; readonly detail: string };

/**
 * What a provider is asked to do. Deliberately narrower than "run an agent".
 *
 * Other tools in this space drive whole coding agents, each with its own idea of
 * tools and permissions. Maschina asks a question and does the acting itself,
 * because authority is Maschina's to grant and a step is one decision and at
 * most one world effect (`03-RUNTIME` §2).
 */
export interface ProviderRequest {
	readonly modelClass: ModelClass;
	readonly prompt: string;
	/** Micro-dollars still available, so a provider can refuse rather than overrun. */
	readonly budget: number;
}

export interface ProviderAnswer {
	readonly text: string;
	/** Which model actually answered. The log stays concrete (`04-WORKERS` §7). */
	readonly model: string;
	readonly provider: string;
	/** List value in micro-dollars, integer. `ADR-009` §3. */
	readonly cost: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly durationMs: number;
}

/** A provider that could not answer, and whether waiting would help. */
export class ProviderUnavailable extends Error {
	constructor(
		readonly provider: string,
		readonly state: Exclude<ProviderState, { available: true }>,
	) {
		super(
			state.reason === "quota"
				? `${provider} is out of quota until ${state.until.toISOString()}`
				: `${provider} is unavailable: ${state.detail}`,
		);
		this.name = "ProviderUnavailable";
	}
}

export interface ProviderDriver {
	readonly provider: Provider;
	/** Can it answer right now, and if not, would waiting help? */
	check(): Promise<ProviderState>;
	ask(request: ProviderRequest): Promise<ProviderAnswer>;
}

/**
 * Pick a provider for a class.
 *
 * In order, first that can answer. The order is configuration, so preferring a
 * local model over a paid one is a setting rather than a rewrite.
 *
 * Returns the reason nothing could answer as well as the answer, because "no
 * provider is available" and "no provider serves this class" need different
 * responses: the first waits, the second asks a person.
 */
export interface Choice {
	readonly driver: ProviderDriver | null;
	/** When the earliest provider will be back, if that is why none was chosen. */
	readonly retryAt: Date | null;
	readonly why: string;
	/** True when this is not the provider that would normally have answered. */
	readonly fellBack: boolean;
	/** Who would have answered, when this is a fallback. */
	readonly instead: string | null;
}

export interface ChooseOptions {
	/**
	 * May another provider answer when the preferred one cannot?
	 *
	 * **Off by default, and that is the point.** Walking down a list until
	 * something answers is the silent degradation `01-PRINCIPLES` forbids: the
	 * caller asked for a class, got an answer, and nothing in the exchange said a
	 * different model produced it. An objective may legitimately require what it
	 * asked for and nothing else.
	 *
	 * Found by writing the proof for it. The first version walked the list, and
	 * a provider that was out of quota was quietly replaced by a paid one.
	 */
	readonly allowFallback?: boolean;
}

export async function choose(
	drivers: readonly ProviderDriver[],
	modelClass: ModelClass,
	options: ChooseOptions = {},
): Promise<Choice> {
	const nothing = { driver: null, fellBack: false, instead: null } as const;
	const serving = drivers.filter((d) => d.provider.models[modelClass] !== undefined);

	if (serving.length === 0) {
		return {
			...nothing,
			retryAt: null,
			// No clock fixes this. Somebody has to configure a provider, or the
			// objective has to ask for a class that exists.
			why: `no provider serves the ${modelClass} class`,
		};
	}

	// Only the preferred one, unless falling back was asked for.
	const considered = options.allowFallback === true ? serving : serving.slice(0, 1);
	const preferred = serving[0]?.provider.id ?? null;

	let earliest: Date | null = null;
	const unavailable: string[] = [];

	for (const driver of considered) {
		const state = await driver.check();
		if (state.available) {
			const fellBack = driver.provider.id !== preferred;
			return {
				driver,
				retryAt: null,
				fellBack,
				instead: fellBack ? preferred : null,
				why: fellBack
					? `${driver.provider.id} answered instead of ${preferred}`
					: `${driver.provider.id} answered`,
			};
		}

		if (state.reason === "quota") {
			if (earliest === null || state.until < earliest) earliest = state.until;
			unavailable.push(`${driver.provider.id} until ${state.until.toISOString()}`);
		} else {
			unavailable.push(`${driver.provider.id} ${state.detail}`);
		}
	}

	const others = serving.length - considered.length;
	return {
		...nothing,
		retryAt: earliest,
		why:
			`${considered.map((d) => d.provider.id).join(", ")} cannot serve ${modelClass}: ` +
			unavailable.join(", ") +
			(others > 0
				? `. ${others} other provider(s) could, but falling back was not permitted`
				: ""),
	};
}
