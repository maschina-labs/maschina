import type { TraderView } from "@maschina/contracts";
import { type TraderState, usd, worthNow } from "@maschina/manager";

/** A run as the app shows it: dollars with cents, the newest hundred log lines, newest first. */
export function traderView(id: string, state: TraderState): TraderView {
	return {
		id,
		mode: state.mode,
		status: state.status,
		...(state.pausedBecause ? { pausedBecause: state.pausedBecause } : {}),
		startedAt: state.startedAt,
		startingCash: usd(state.book.startingCash),
		cash: usd(state.book.cash),
		worth: usd(worthNow(state)),
		realized: usd(state.book.realized),
		fees: usd(state.book.fees),
		trades: state.book.fills.length,
		holdings: state.book.holdings.map((held) => {
			const value = state.values[held.mint];
			return {
				symbol: held.symbol,
				mint: held.mint,
				cost: usd(held.cost),
				worth: value === undefined ? null : usd(BigInt(value)),
			};
		}),
		thinking: {
			spentUsd: Math.round(state.think.spentUsd * 10_000) / 10_000,
			turns: state.think.turns,
			...(state.think.lastAt ? { lastAt: state.think.lastAt } : {}),
		},
		log: state.log
			.slice(-100)
			.reverse()
			.map((entry) => ({
				at: entry.at,
				kind: entry.kind,
				text: entry.text,
				...(entry.costUsd === undefined ? {} : { costUsd: entry.costUsd }),
			})),
	};
}
