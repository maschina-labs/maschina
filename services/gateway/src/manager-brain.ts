/**
 * The manager in conversation: what it is told, and what it can look at.
 *
 * In conversation the manager only looks. It reads the owner's machines, their records and the open
 * market, and it answers. It cannot trade, move money or change a machine from here: those go through
 * the same routes and rules as the owner's own buttons, and the trader that acts on its own has limits
 * of its own. So nothing said in a chat, by anybody, can make it spend.
 */

import type { Tool } from "@maschina/manager";
import type { MarketToken, ScanInterval } from "@maschina/solana";

export const SYSTEM = `You are the manager inside Maschina, an app where people run trading machines on Solana. You work for the person you are talking to, on their own Anthropic key, so every word you write costs them a little. Be brief and useful.

What you can do here: look at their machines, read what each one did, and scan the open Solana memecoin market. You cannot trade, move money, or change a machine from this chat. If they want something done, say exactly what to press, or say that the AI trader can do it once they give it money to work with.

How to talk: plain, direct, short sentences. American English. No hype, no exclamation marks, no emoji, no dashes used as punctuation. Use numbers. Say when you do not know or when a tool failed. Never promise a profit: memecoins mostly lose money for people who trade them, fees take 1 to 2 percent of every round trip, and you say so when it matters. Paper machines trade on real prices with pretend money; never mix paper and live figures together.

Amounts from the tools: dollars are already in dollars. Prices are in US dollars per token.`;

export type BrainPorts = {
	machines(): Promise<unknown[]>;
	record(machineId: string): Promise<unknown[] | undefined>;
	scan(request: { interval: ScanInterval; limit: number }): Promise<MarketToken[]>;
};

const round = (value: number | undefined, places = 2) =>
	value === undefined ? null : Number(value.toFixed(places));

/** A token as the manager reads it: the figures that matter for a quick trade, and no more. */
export function compactToken(token: MarketToken) {
	return {
		symbol: token.symbol,
		mint: token.mint,
		priceUsd: token.priceUsd ?? null,
		liquidityUsd: round(token.liquidityUsd, 0),
		marketCapUsd: round(token.marketCapUsd, 0),
		holders: token.holders ?? null,
		ageHours: round(token.ageHours, 1),
		organic: round(token.organicScore, 0),
		verified: token.verified,
		canMintMore: token.mintable ?? null,
		canFreeze: token.freezable ?? null,
		topHoldersPct: round(token.topHoldersPct, 1),
		change5mPct: round(token.m5.priceChangePct),
		change1hPct: round(token.h1.priceChangePct),
		volume5mUsd: round(token.m5.volumeUsd, 0),
		volume1hUsd: round(token.h1.volumeUsd, 0),
		buysSells5m: token.m5.buys === undefined ? null : `${token.m5.buys}/${token.m5.sells ?? 0}`,
		foundBy: token.foundBy,
	};
}

const INTERVALS = ["5m", "1h", "6h", "24h"] as const;

export function brainTools(ports: BrainPorts): Tool[] {
	return [
		{
			name: "list_machines",
			description:
				"The owner's machines: name, kind, state, whether it is paper, what it has to spend and what it has made. Amounts are in each machine's budget currency's smallest unit (USDC has 6 decimals).",
			input_schema: { type: "object", properties: {} },
			run: async () => ports.machines(),
		},
		{
			name: "machine_record",
			description:
				"What one machine did recently, newest first: trades, refusals, failures, pauses. Use the machineId from list_machines.",
			input_schema: {
				type: "object",
				properties: { machineId: { type: "string" } },
				required: ["machineId"],
			},
			run: async (input) => {
				const id = typeof input["machineId"] === "string" ? input["machineId"] : "";
				const events = await ports.record(id);
				if (!events) throw new Error("no machine of theirs has that id");
				return events;
			},
		},
		{
			name: "scan_market",
			description:
				"The Solana tokens moving most right now, from Jupiter's trending, most traded and organic rankings, merged. Use it to find candidates for quick trades. Each has price, liquidity, holders, age, whether more can be minted or holders frozen, and price and volume change over 5 minutes and 1 hour.",
			input_schema: {
				type: "object",
				properties: {
					interval: {
						type: "string",
						enum: [...INTERVALS],
						description: "Ranking window, default 1h",
					},
					limit: {
						type: "integer",
						minimum: 5,
						maximum: 100,
						description: "How many per ranking, default 30",
					},
				},
			},
			run: async (input) => {
				const interval = INTERVALS.find((each) => each === input["interval"]) ?? "1h";
				const limit =
					typeof input["limit"] === "number" ? Math.min(Math.max(input["limit"], 5), 100) : 30;
				return (await ports.scan({ interval, limit })).map(compactToken);
			},
		},
	];
}
