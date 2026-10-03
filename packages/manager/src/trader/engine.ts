/**
 * The AI trader's engine: the fast loop that watches, and the slow one that thinks.
 *
 * Every tick, which is seconds, the engine prices what it holds, sells anything down past its stop, and
 * pauses the whole trader if the book is down past its drawdown. None of that asks the AI: a stop that
 * waits for a model to agree is not a stop.
 *
 * Every so often, or sooner when something moves, it wakes the AI with the book and the limits, and the
 * AI acts through its tools. Each tool goes through the limits before it touches the book, so the AI can
 * only ever do what the owner allowed. Thinking has its own daily cap in dollars, so the owner's credit
 * cannot run out overnight: past the cap the engine keeps guarding the money and the AI waits for the
 * next day.
 *
 * Paper and live share all of this. Only where a fill comes from differs: paper fills at what a real
 * quote said; live will fill through the signer.
 */

import { type Claude, MODELS } from "../claude.ts";
import { converse } from "../converse.ts";
import { type Book, buy, type Holding, newBook, sell, worth } from "./book.ts";
import { type ExitPlan, exitFor, withPeak } from "./exits.ts";
import { checkBuy, DEFAULT_LIMITS, drawdownHit, type TraderLimits } from "./limits.ts";
import { traderTools } from "./tools.ts";

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** What a Solana swap costs in network fees, priority included, in USDC's smallest unit: about half a cent. */
export const NETWORK_FEE = 5_000n;

export type LogEntry = {
	at: string;
	kind: "think" | "buy" | "sell" | "stop" | "refused" | "paused" | "error";
	text: string;
	costUsd?: number;
};

export type TraderState = {
	id: string;
	mode: "paper";
	status: "running" | "paused" | "stopped";
	pausedBecause?: string;
	book: Book;
	limits: TraderLimits;
	/** What each holding would sell for at the last tick, in USDC's smallest unit. */
	values: Record<string, string>;
	/** What each was worth when the AI last looked, to tell when something has moved enough to wake it. */
	valuesAtThink: Record<string, string>;
	think: {
		lastAt?: string;
		everyMs: number;
		/** A holding moving this far since the AI last looked wakes it early. Percent. */
		wakeOnMovePct: number;
		dailyCapUsd: number;
		day: string;
		spentTodayUsd: number;
		spentUsd: number;
		turns: number;
	};
	/** How each holding gets out, set by the AI and kept by the engine every tick. */
	plans?: Record<string, ExitPlan>;
	/** Symbols and decimals of tokens it has seen, so a buy knows what it is buying. */
	tokens: Record<string, { symbol: string; decimals: number }>;
	log: LogEntry[];
	startedAt: string;
};

export type EnginePorts = {
	now(): Date;
	claude: Claude;
	/** What a swap of this amount would produce right now, and how far it moves the price. */
	quote(request: { inputMint: string; outputMint: string; amount: bigint }): Promise<{
		outAmount: bigint;
		impactPct: number;
	}>;
	/** Prices in US dollars per whole token. Missing for a token that cannot be priced. */
	prices(mints: string[]): Promise<Map<string, number>>;
	scan(request: { interval: "5m" | "1h" | "6h" | "24h"; limit: number }): Promise<unknown[]>;
	/** Symbol and decimals for a token it has not seen in a scan. */
	token(mint: string): Promise<{ symbol: string; decimals: number } | undefined>;
};

const LOG_KEPT = 500;

export function newTrader(input: {
	id: string;
	cash: bigint;
	now: Date;
	limits?: Partial<TraderLimits>;
	think?: Partial<Pick<TraderState["think"], "everyMs" | "wakeOnMovePct" | "dailyCapUsd">>;
}): TraderState {
	return {
		id: input.id,
		mode: "paper",
		status: "running",
		book: newBook(input.cash),
		limits: { ...DEFAULT_LIMITS, ...input.limits },
		values: {},
		valuesAtThink: {},
		think: {
			everyMs: input.think?.everyMs ?? 60_000,
			wakeOnMovePct: input.think?.wakeOnMovePct ?? 8,
			dailyCapUsd: input.think?.dailyCapUsd ?? 2,
			day: input.now.toISOString().slice(0, 10),
			spentTodayUsd: 0,
			spentUsd: 0,
			turns: 0,
		},
		plans: {},
		tokens: {},
		log: [],
		startedAt: input.now.toISOString(),
	};
}

export const note = (state: TraderState, entry: Omit<LogEntry, "at">, now: Date): TraderState => ({
	...state,
	log: [...state.log, { at: now.toISOString(), ...entry }].slice(-LOG_KEPT),
});

/** What a holding sells for at a price in dollars per whole token, in USDC's smallest unit. */
export function valueAt(held: Holding, usdPerToken: number): bigint {
	const whole = Number(held.amount) / 10 ** held.decimals;
	return BigInt(Math.floor(whole * usdPerToken * 1_000_000));
}

export const worthNow = (state: TraderState): bigint =>
	worth(state.book, (held) => {
		const value = state.values[held.mint];
		return value === undefined ? undefined : BigInt(value);
	});

/** Sells a holding, or part of it, at a fresh quote. Shared by the stop and the AI's own sales. */
export async function sellHolding(
	state: TraderState,
	ports: EnginePorts,
	request: { mint: string; amount: bigint; reason: string; kind: "sell" | "stop" },
): Promise<TraderState> {
	const now = ports.now();
	const held = state.book.holdings.find((each) => each.mint === request.mint);
	if (!held)
		return note(state, { kind: "error", text: `nothing of ${request.mint} is held to sell` }, now);
	const quoted = await ports.quote({
		inputMint: request.mint,
		outputMint: USDC_MINT,
		amount: request.amount,
	});
	const book = sell(state.book, {
		at: now,
		mint: request.mint,
		amount: request.amount,
		usdc: quoted.outAmount,
		feeUsdc: NETWORK_FEE,
		reason: request.reason,
	});
	const fill = book.fills.at(-1);
	const values = { ...state.values };
	const plans = { ...(state.plans ?? {}) };
	if (!book.holdings.some((each) => each.mint === request.mint)) {
		delete values[request.mint];
		delete plans[request.mint];
	}
	return note(
		{ ...state, book, values, plans },
		{
			kind: request.kind,
			text: `Sold ${held.symbol} for $${usd(quoted.outAmount)} (${signedUsd(fill?.realized ?? 0n)}): ${request.reason}`,
		},
		now,
	);
}

/** Buys at a fresh quote, if the limits allow. Shared by the AI's tool and anything else that buys. */
export async function buyToken(
	state: TraderState,
	ports: EnginePorts,
	request: { mint: string; usdc: bigint; reason: string; plan?: ExitPlan },
): Promise<{ state: TraderState; done: boolean; why?: string }> {
	const now = ports.now();
	const known = state.tokens[request.mint] ?? (await ports.token(request.mint));
	if (!known) {
		const why = "that token's decimals could not be found, so it cannot be counted";
		return { state: note(state, { kind: "refused", text: why }, now), done: false, why };
	}
	const quoted = await ports.quote({
		inputMint: USDC_MINT,
		outputMint: request.mint,
		amount: request.usdc,
	});
	const verdict = checkBuy(
		state.book,
		{
			mint: request.mint,
			usdc: request.usdc,
			impactPct: quoted.impactPct,
			now,
			worthNow: worthNow(state),
		},
		state.limits,
	);
	if (!verdict.allowed) {
		const refused = note(
			state,
			{ kind: "refused", text: `Did not buy ${known.symbol}: ${verdict.reason}` },
			now,
		);
		return {
			state: verdict.pause ? pause(refused, verdict.reason, now) : refused,
			done: false,
			why: verdict.reason,
		};
	}
	// The cap is on what a trade spends; the network fee is paid on top, from cash.
	if (request.usdc + NETWORK_FEE > state.book.cash) {
		const why = `only $${usd(state.book.cash)} of cash is left, fee included`;
		return {
			state: note(state, { kind: "refused", text: `Did not buy ${known.symbol}: ${why}` }, now),
			done: false,
			why,
		};
	}
	if (quoted.outAmount <= 0n) {
		const why = "the quote would give nothing back";
		return {
			state: note(state, { kind: "refused", text: `Did not buy ${known.symbol}: ${why}` }, now),
			done: false,
			why,
		};
	}
	const book = buy(state.book, {
		at: now,
		mint: request.mint,
		symbol: known.symbol,
		decimals: known.decimals,
		usdc: request.usdc,
		received: quoted.outAmount,
		feeUsdc: NETWORK_FEE,
		reason: request.reason,
	});
	return {
		state: note(
			{
				...state,
				book,
				tokens: { ...state.tokens, [request.mint]: known },
				plans: {
					...(state.plans ?? {}),
					[request.mint]: {
						...(state.plans?.[request.mint] ?? {}),
						...(request.plan ?? {}),
						peak: request.usdc.toString(),
					},
				},
				// Worth what was paid for it until the next tick prices it, so a sharp move straight after a buy
				// is still measured against something.
				values: {
					...state.values,
					[request.mint]: `${(state.values[request.mint] ? BigInt(state.values[request.mint] as string) : 0n) + request.usdc}`,
				},
			},
			{ kind: "buy", text: `Bought $${usd(request.usdc)} of ${known.symbol}: ${request.reason}` },
			now,
		),
		done: true,
	};
}

const pause = (state: TraderState, why: string, now: Date): TraderState =>
	note(
		{ ...state, status: "paused", pausedBecause: why },
		{ kind: "paused", text: `Paused: ${why}` },
		now,
	);

/** One tick: price, enforce the stops and the drawdown, and think if it is time. */
export async function tick(state: TraderState, ports: EnginePorts): Promise<TraderState> {
	if (state.status !== "running") return state;
	const now = ports.now();
	let next = rollDay(state, now);

	// Price what it holds.
	const mints = next.book.holdings.map((each) => each.mint);
	if (mints.length) {
		try {
			const prices = await ports.prices(mints);
			const values: Record<string, string> = {};
			for (const held of next.book.holdings) {
				const price = prices.get(held.mint);
				if (price !== undefined) values[held.mint] = valueAt(held, price).toString();
				else if (next.values[held.mint] !== undefined)
					values[held.mint] = next.values[held.mint] as string;
			}
			next = { ...next, values };
		} catch (error) {
			next = note(
				next,
				{ kind: "error", text: `Prices could not be read: ${message(error)}` },
				now,
			);
		}
	}

	// Each holding's best value so far, for its trailing stop.
	const plans = { ...(next.plans ?? {}) };
	for (const held of next.book.holdings) {
		const kept = withPeak(plans[held.mint] ?? {}, known(next.values[held.mint]));
		if (kept) plans[held.mint] = kept;
	}
	next = { ...next, plans };

	// The exits, kept by the engine every tick: the AI's plan, under the owner's stop, which it cannot argue with.
	let stopped = false;
	for (const held of [...next.book.holdings]) {
		const exit = exitFor(
			held,
			known(next.values[held.mint]),
			next.plans?.[held.mint],
			next.limits.stopLossPct,
		);
		if (!exit) continue;
		try {
			next = await sellHolding(next, ports, {
				mint: held.mint,
				amount: held.amount,
				reason: exit.reason,
				kind: exit.kind,
			});
			stopped = true;
		} catch (error) {
			next = note(
				next,
				{ kind: "error", text: `The stop on ${held.symbol} could not sell: ${message(error)}` },
				now,
			);
		}
	}

	if (drawdownHit(next.book, worthNow(next), next.limits))
		return pause(
			next,
			`the book is down ${next.limits.drawdownPausePct}% or more from where it started`,
			now,
		);

	return shouldThink(next, now, stopped) ? think(next, ports) : next;
}

function shouldThink(state: TraderState, now: Date, stopped: boolean): boolean {
	if (state.think.spentTodayUsd >= state.think.dailyCapUsd) return false;
	if (!state.think.lastAt || stopped) return true;
	if (now.getTime() - Date.parse(state.think.lastAt) >= state.think.everyMs) return true;
	return state.book.holdings.some((held) => {
		const was = known(state.valuesAtThink[held.mint]);
		const is = known(state.values[held.mint]);
		if (was === undefined || is === undefined || was === 0n) return false;
		const moved = Math.abs((Number(is - was) / Number(was)) * 100);
		return moved >= state.think.wakeOnMovePct;
	});
}

const SYSTEM = `You are an AI trader inside Maschina, trading Solana memecoins on PAPER: real prices and real quotes, pretend money. Your one goal is to grow the book's total worth, through quick trades in and out.

You act only through your tools. Every buy is checked against limits you cannot change, and a refused buy tells you why.

Speed comes from exit plans. Give every buy a take profit, a stop and a trail. The engine checks prices every few seconds and sells the moment a plan says so, without waiting for you, so a plan works while you are not looking. Change a plan with set_exit when the picture changes. The owner's stop is a floor you cannot loosen, and the whole book pauses if it falls past its drawdown.

Each round trip costs real money in pool fees, price impact and network fees, often 1 to 2 percent. Only trade when you expect the move to beat that. Doing nothing is a valid choice, and churning is how a book bleeds to zero.

You wake every few minutes, or sooner when a holding moves. Each time: look at the book, scan the market if you need candidates, act or not, then end with two or three short sentences on what you did and why. Plain words, no hype, no dashes as punctuation. Your thinking costs the owner money, so be decisive and do not repeat scans you do not need.`;

async function think(state: TraderState, ports: EnginePorts): Promise<TraderState> {
	const now = ports.now();
	// The tools change the state as the AI acts, so they share one place to keep it.
	const held = { state };
	const tools = traderTools(held, ports);
	try {
		const turn = await converse({
			claude: ports.claude,
			// Fast and cheap, so it can look every minute without eating the owner's credit.
			model: MODELS.glance,
			system: SYSTEM,
			messages: [{ role: "user", content: briefing(state, now) }],
			tools,
			// Routine looks: decisive, not deliberate. Room enough that thinking never crowds out acting.
			maxTokens: 8_000,
			effort: "low",
		});
		const after = held.state;
		const done = ports.now();
		return note(
			{
				...after,
				valuesAtThink: { ...after.values },
				think: {
					...after.think,
					lastAt: now.toISOString(),
					spentTodayUsd: after.think.spentTodayUsd + turn.costUsd,
					spentUsd: after.think.spentUsd + turn.costUsd,
					turns: after.think.turns + 1,
				},
			},
			{ kind: "think", text: turn.reply, costUsd: turn.costUsd },
			// Stamped when the look ends, so it reads after the trades it made.
			done,
		);
	} catch (error) {
		// A failed thought still counts as having looked, so a broken key is not retried every tick.
		return note(
			{ ...held.state, think: { ...held.state.think, lastAt: now.toISOString() } },
			{ kind: "error", text: `Could not think: ${message(error)}` },
			now,
		);
	}
}

/** What the AI is told when it wakes: the book, what it is worth, and the limits. */
export function briefing(state: TraderState, now: Date): string {
	const book = state.book;
	const lines = book.holdings.map((held) => {
		const value = known(state.values[held.mint]);
		const change = value === undefined ? "unpriced" : `${pct(value, held.cost)} since bought`;
		const plan = state.plans?.[held.mint];
		const exits = plan
			? [
					plan.takeProfitPct === undefined ? "" : `take profit +${plan.takeProfitPct}%`,
					plan.stopPct === undefined ? "" : `stop -${plan.stopPct}%`,
					plan.trailPct === undefined ? "" : `trail ${plan.trailPct}%`,
				]
					.filter(Boolean)
					.join(", ") || "no plan"
			: "no plan";
		return `- ${held.symbol} (${held.mint}): cost $${usd(held.cost)}, now $${value === undefined ? "?" : usd(value)}, ${change}, held ${minutes(now, held.openedAt)} min, exits: ${exits}`;
	});
	const total = worthNow(state);
	return [
		`Time: ${now.toISOString()}`,
		`Cash: $${usd(book.cash)}. Worth in total: $${usd(total)}, started at $${usd(book.startingCash)} (${pct(total, book.startingCash)}).`,
		`Realized so far: ${signedUsd(book.realized)}. Fees paid: $${usd(book.fees)}. Trades: ${book.fills.length}.`,
		lines.length ? `Holding:\n${lines.join("\n")}` : "Holding nothing.",
		`Limits: at most $${usd(state.limits.maxPerTrade)} per buy, ${state.limits.maxPositions} tokens at once, ${state.limits.maxTradesPerHour} trades an hour, ${state.limits.maxImpactPct}% price impact. Stop at ${state.limits.stopLossPct}% down per holding; paused at ${state.limits.drawdownPausePct}% down overall.`,
		`Your thinking today has cost $${state.think.spentTodayUsd.toFixed(3)} of a $${state.think.dailyCapUsd.toFixed(2)} cap.`,
	].join("\n");
}

function rollDay(state: TraderState, now: Date): TraderState {
	const day = now.toISOString().slice(0, 10);
	return day === state.think.day
		? state
		: { ...state, think: { ...state.think, day, spentTodayUsd: 0 } };
}

const known = (value: string | undefined) => (value === undefined ? undefined : BigInt(value));
/** Dollars and cents from USDC's smallest unit, cut rather than rounded, so a figure is never flattered. */
export const usd = (units: bigint) => {
	const negative = units < 0n;
	const cents = (negative ? -units : units) / 10_000n;
	return `${negative ? "-" : ""}${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
};
const signedUsd = (units: bigint) =>
	`${units < 0n ? "-" : "+"}$${usd(units < 0n ? -units : units)}`;
const pct = (now: bigint, was: bigint) => {
	if (was === 0n) return "n/a";
	const change = (Number(now - was) / Number(was)) * 100;
	return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
};
const minutes = (now: Date, since: Date) => Math.round((now.getTime() - since.getTime()) / 60_000);
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
