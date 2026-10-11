/**
 * Every kind of machine, as the create screen offers them: what it earns from, and whether it can be made
 * yet. The set comes from MONEY-MAP and D-090: every kind is set once and never needs resetting. Kinds
 * that exist take their name from their own module, so nothing here can drift from what the runtime calls them.
 */

import { followingRange, priceTrigger, range, recurringBuy } from "@maschina/runtime";

export type KindCard = { id: string; name: string; earns: string; ready: boolean };

export const KIND_CARDS: KindCard[] = [
	{
		id: followingRange.kind,
		name: "RANGE FINDER",
		earns: "CHOP, AND IT FOLLOWS THE PRICE",
		ready: true,
	},
	{ id: range.kind, name: "FIXED RANGE", earns: "CHOP INSIDE A BAND YOU SET", ready: true },
	{ id: "grid", name: "GRID", earns: "CHOP, MORE OFTEN THAN A RANGE", ready: false },
	{
		id: recurringBuy.kind,
		name: "RECURRING BUY",
		earns: "BUILDING A POSITION OVER TIME",
		ready: false,
	},
	{
		id: priceTrigger.kind,
		name: "PRICE TRIGGER",
		earns: "ONE MOVE: A DIP, A TARGET, A STOP",
		ready: false,
	},
	{
		id: "trailing_stop",
		name: "TRAILING STOP",
		earns: "PROTECTING A HOLDING AS IT RISES",
		ready: false,
	},
	{
		id: "rebalancer",
		name: "REBALANCER",
		earns: "SELLING HIGHS AND BUYING LOWS BETWEEN ASSETS",
		ready: false,
	},
	{
		id: "yield_parker",
		name: "YIELD PARKER",
		earns: "INTEREST ON IDLE MONEY, ALL THE TIME",
		ready: false,
	},
];
