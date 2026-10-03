/**
 * The AI trader's hands: the only things it can do.
 *
 * Look at the market, look at its book, buy and sell. A buy goes through the limits before it touches
 * the book, so these tools can do nothing the owner did not allow. There is no tool that moves money
 * anywhere but into a trade and back, and none that changes a limit.
 */

import type { Tool } from "../converse.ts";
import {
	buyToken,
	type EnginePorts,
	sellHolding,
	type TraderState,
	usd,
	worthNow,
} from "./engine.ts";
import { shortlist, sweep, type UniverseToken } from "./universe.ts";

/** Whole dollars in, USDC's smallest unit out, refusing anything that is not a sensible amount. */
function dollarsToUnits(value: unknown): bigint {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
		throw new Error("say how many dollars, above zero");
	return BigInt(Math.round(value * 1_000_000));
}

const remember = (state: TraderState, found: unknown[]): TraderState => {
	const tokens = { ...state.tokens };
	for (const each of found) {
		const token = each as { mint?: unknown; symbol?: unknown; decimals?: unknown };
		if (typeof token.mint === "string" && typeof token.decimals === "number")
			tokens[token.mint] = {
				symbol: typeof token.symbol === "string" ? token.symbol : "?",
				decimals: token.decimals,
			};
	}
	return { ...state, tokens };
};

export function traderTools(held: { state: TraderState }, ports: EnginePorts): Tool[] {
	let swept: { at: number; tokens: UniverseToken[] } | undefined;
	return [
		{
			name: "scan_market",
			description:
				"Every token moving on Solana right now: Jupiter's trending, most traded and organic rankings over 5 minutes, 1 hour, 6 hours and 24 hours, a hundred deep each, merged. Usually several hundred tokens. You get them ranked by how much money is moving through each against its pool depth and which way its price is going, a page at a time. Each has price, liquidity, market cap, holders, age, mint and freeze flags, top holder share, and 5 minute and 1 hour change and volume. One sweep is reused for a minute.",
			input_schema: {
				type: "object",
				properties: {
					count: {
						type: "integer",
						minimum: 5,
						maximum: 60,
						description: "How many to show, default 30",
					},
					skip: {
						type: "integer",
						minimum: 0,
						description: "How many of the ranked list to skip, for the next page",
					},
				},
			},
			run: async (input) => {
				const now = ports.now().getTime();
				if (!swept || now - swept.at > 60_000) swept = { at: now, tokens: await sweep(ports.scan) };
				held.state = remember(held.state, swept.tokens);
				const count =
					typeof input["count"] === "number" ? Math.min(Math.max(input["count"], 5), 60) : 30;
				const skip = typeof input["skip"] === "number" ? Math.max(input["skip"], 0) : 0;
				const ranked = shortlist(swept.tokens, skip + count).slice(skip);
				return {
					universe: swept.tokens.length,
					showing: ranked.length,
					skipped: skip,
					tokens: ranked,
				};
			},
		},
		{
			name: "quote",
			description:
				"What buying a dollar amount of a token would get right now, and how far it would move the price. Nothing is bought.",
			input_schema: {
				type: "object",
				properties: { mint: { type: "string" }, usd: { type: "number" } },
				required: ["mint", "usd"],
			},
			run: async (input) => {
				const mint = String(input["mint"] ?? "");
				const quoted = await ports.quote({
					inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
					outputMint: mint,
					amount: dollarsToUnits(input["usd"]),
				});
				return { tokensOut: quoted.outAmount.toString(), priceImpactPct: quoted.impactPct };
			},
		},
		{
			name: "buy",
			description:
				"Buy a dollar amount of a token, filled at a fresh quote. Checked against the limits first; a refusal says why. Give a one sentence reason, which is kept with the trade.",
			input_schema: {
				type: "object",
				properties: {
					mint: { type: "string" },
					usd: { type: "number" },
					reason: { type: "string" },
				},
				required: ["mint", "usd", "reason"],
			},
			run: async (input) => {
				const done = await buyToken(held.state, ports, {
					mint: String(input["mint"] ?? ""),
					usdc: dollarsToUnits(input["usd"]),
					reason: String(input["reason"] ?? "no reason given").slice(0, 300),
				});
				held.state = done.state;
				if (!done.done) throw new Error(`not bought: ${done.why}`);
				return { bought: true, cashLeft: usd(held.state.book.cash) };
			},
		},
		{
			name: "sell",
			description:
				"Sell some or all of a holding, filled at a fresh quote. Selling is always allowed. Give the percent of the holding to sell and a one sentence reason.",
			input_schema: {
				type: "object",
				properties: {
					mint: { type: "string" },
					percent: { type: "number", minimum: 1, maximum: 100 },
					reason: { type: "string" },
				},
				required: ["mint", "percent", "reason"],
			},
			run: async (input) => {
				const mint = String(input["mint"] ?? "");
				const holding = held.state.book.holdings.find((each) => each.mint === mint);
				if (!holding) throw new Error("nothing of that token is held");
				const percent =
					typeof input["percent"] === "number" ? Math.min(Math.max(input["percent"], 1), 100) : 100;
				const amount =
					percent >= 100
						? holding.amount
						: (holding.amount * BigInt(Math.round(percent * 100))) / 10_000n;
				if (amount <= 0n) throw new Error("that is too little to sell");
				held.state = await sellHolding(held.state, ports, {
					mint,
					amount,
					reason: String(input["reason"] ?? "no reason given").slice(0, 300),
					kind: "sell",
				});
				return { sold: true, cash: usd(held.state.book.cash) };
			},
		},
		{
			name: "book",
			description:
				"The book right now: cash, each holding with what it cost and is worth, and the total.",
			input_schema: { type: "object", properties: {} },
			run: async () => ({
				cash: usd(held.state.book.cash),
				worth: usd(worthNow(held.state)),
				holdings: held.state.book.holdings.map((each) => ({
					symbol: each.symbol,
					mint: each.mint,
					cost: usd(each.cost),
					worth:
						held.state.values[each.mint] === undefined
							? null
							: usd(BigInt(held.state.values[each.mint] as string)),
				})),
			}),
		},
	];
}
