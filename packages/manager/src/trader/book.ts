/**
 * The AI trader's book: its cash, what it holds, and every fill, in exact amounts.
 *
 * Cash is USDC in its smallest unit (six decimals) and holdings are each token's smallest unit, both as
 * whole numbers, so nothing drifts through rounding over hundreds of trades. A fill takes what a real
 * quote said the trade would produce, which already carries the pool's fee and the price impact, and
 * then takes the network fee off cash as well. So paper pays what live would pay, and a paper result is
 * one worth believing.
 *
 * The book never decides anything. It records, and it refuses what cannot be true: spending cash it does
 * not have, or selling a token it does not hold.
 */

export type Holding = {
	mint: string;
	symbol: string;
	decimals: number;
	/** How much it holds, in the token's smallest unit. */
	amount: bigint;
	/** What the current amount cost, fees included, in USDC's smallest unit. */
	cost: bigint;
	openedAt: Date;
};

export type Fill = {
	at: Date;
	side: "buy" | "sell";
	mint: string;
	symbol: string;
	/** USDC spent on a buy, or received on a sale, before the network fee. */
	usdc: bigint;
	/** Tokens received on a buy, or sold. */
	amount: bigint;
	feeUsdc: bigint;
	/** Profit or loss a sale realized against what that part had cost. Zero for a buy. */
	realized: bigint;
	reason: string;
};

export type Book = {
	startingCash: bigint;
	cash: bigint;
	holdings: Holding[];
	fills: Fill[];
	realized: bigint;
	fees: bigint;
};

export const newBook = (cash: bigint): Book => ({
	startingCash: cash,
	cash,
	holdings: [],
	fills: [],
	realized: 0n,
	fees: 0n,
});

export class BookError extends Error {}

export function buy(
	book: Book,
	fill: {
		at: Date;
		mint: string;
		symbol: string;
		decimals: number;
		usdc: bigint;
		received: bigint;
		feeUsdc: bigint;
		reason: string;
	},
): Book {
	if (fill.usdc <= 0n || fill.received <= 0n)
		throw new BookError("a buy must spend and receive something");
	const total = fill.usdc + fill.feeUsdc;
	if (total > book.cash) throw new BookError(`not enough cash: needs ${total}, has ${book.cash}`);
	const held = book.holdings.find((each) => each.mint === fill.mint);
	const holdings = held
		? book.holdings.map((each) =>
				each.mint === fill.mint
					? { ...each, amount: each.amount + fill.received, cost: each.cost + total }
					: each,
			)
		: [
				...book.holdings,
				{
					mint: fill.mint,
					symbol: fill.symbol,
					decimals: fill.decimals,
					amount: fill.received,
					cost: total,
					openedAt: fill.at,
				},
			];
	return {
		...book,
		cash: book.cash - total,
		holdings,
		fees: book.fees + fill.feeUsdc,
		fills: [
			...book.fills,
			{
				at: fill.at,
				side: "buy",
				mint: fill.mint,
				symbol: fill.symbol,
				usdc: fill.usdc,
				amount: fill.received,
				feeUsdc: fill.feeUsdc,
				realized: 0n,
				reason: fill.reason,
			},
		],
	};
}

export function sell(
	book: Book,
	fill: { at: Date; mint: string; amount: bigint; usdc: bigint; feeUsdc: bigint; reason: string },
): Book {
	const held = book.holdings.find((each) => each.mint === fill.mint);
	if (!held) throw new BookError("nothing of that token is held");
	if (fill.amount <= 0n || fill.amount > held.amount)
		throw new BookError(`can only sell up to ${held.amount}, asked to sell ${fill.amount}`);
	// The part sold carries its share of what the holding cost.
	const costOfPart = (held.cost * fill.amount) / held.amount;
	const proceeds = fill.usdc - fill.feeUsdc;
	const realized = proceeds - costOfPart;
	const left = held.amount - fill.amount;
	return {
		...book,
		cash: book.cash + proceeds,
		holdings:
			left === 0n
				? book.holdings.filter((each) => each.mint !== fill.mint)
				: book.holdings.map((each) =>
						each.mint === fill.mint
							? { ...each, amount: left, cost: each.cost - costOfPart }
							: each,
					),
		realized: book.realized + realized,
		fees: book.fees + fill.feeUsdc,
		fills: [
			...book.fills,
			{
				at: fill.at,
				side: "sell",
				mint: fill.mint,
				symbol: held.symbol,
				usdc: fill.usdc,
				amount: fill.amount,
				feeUsdc: fill.feeUsdc,
				realized,
				reason: fill.reason,
			},
		],
	};
}

/**
 * What the book is worth, in USDC's smallest unit, given what each holding would sell for now. A holding
 * that cannot be valued counts as nothing: a token that cannot be priced cannot be counted on to sell.
 */
export function worth(book: Book, sellsFor: (held: Holding) => bigint | undefined): bigint {
	return book.holdings.reduce((sum, held) => sum + (sellsFor(held) ?? 0n), book.cash);
}
