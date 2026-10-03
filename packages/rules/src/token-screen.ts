/**
 * The token screen: whether a token is safe enough for a machine to buy at all.
 *
 * Memecoins lose people money in a few well known ways before any trading skill comes into it: a supply
 * that can be inflated, holders that can be frozen, a token that can be bought but never sold, liquidity
 * too thin to get out through, a handful of wallets holding most of it, and tokens a few hours old. Each
 * of those is a fact that can be read, so each is a rule here.
 *
 * Where it applies is set by where a coin was launched. A coin launched on Maschina must pass all of it,
 * whoever trades it. A coin launched anywhere else is the open market: a machine trading it is held to
 * none of these unless its owner turned them on, and then to the ones they chose at the limits they set.
 *
 * Unknown is a refusal. A figure that could not be read is never taken as a good one: the one token in a
 * thousand whose holders cannot be looked up is not the one to bet on.
 */

export type TokenFacts = {
	mint: string;
	/** Who can still create more of it, or null when nobody can. */
	mintAuthority: string | null | undefined;
	/** Who can still freeze holders' balances, or null when nobody can. */
	freezeAuthority: string | null | undefined;
	/** What the largest holders own together, 0 to 1, pools and burn addresses left out. */
	topHoldersShare: number | undefined;
	holders: number | undefined;
	liquidityUsd: number | undefined;
	ageHours: number | undefined;
	/** How far a typical buy and sale would move the price, in percent. */
	buyImpactPct: number | undefined;
	sellImpactPct: number | undefined;
	/** Whether a route exists to sell it back, which is the honeypot question. */
	sellRoute: boolean | undefined;
};

export type ScreenLimits = {
	minLiquidityUsd: number;
	maxTopHoldersShare: number;
	minHolders: number;
	minAgeHours: number;
	maxImpactPct: number;
};

/** The bar for launching on Maschina. Strict on purpose: these are for coins people are meant to trust. */
export const DEFAULT_SCREEN: ScreenLimits = {
	minLiquidityUsd: 25_000,
	maxTopHoldersShare: 0.35,
	minHolders: 500,
	minAgeHours: 24,
	maxImpactPct: 3,
};

export type ScreenVerdict = { passed: boolean; reasons: string[] };

const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function screenToken(
	facts: TokenFacts,
	limits: ScreenLimits = DEFAULT_SCREEN,
): ScreenVerdict {
	const reasons: string[] = [];

	if (facts.mintAuthority === undefined) reasons.push("whether more can be minted is unknown");
	else if (facts.mintAuthority !== null)
		reasons.push("its supply can still be inflated: a mint authority is set");

	if (facts.freezeAuthority === undefined) reasons.push("whether holders can be frozen is unknown");
	else if (facts.freezeAuthority !== null)
		reasons.push("holders can be frozen: a freeze authority is set");

	if (facts.sellRoute === undefined) reasons.push("whether it can be sold is unknown");
	else if (!facts.sellRoute) reasons.push("there is no route to sell it: it could be a honeypot");

	if (facts.liquidityUsd === undefined) reasons.push("its liquidity is unknown");
	else if (facts.liquidityUsd < limits.minLiquidityUsd)
		reasons.push(
			`liquidity is ${dollars(facts.liquidityUsd)}, below the ${dollars(limits.minLiquidityUsd)} minimum`,
		);

	if (facts.topHoldersShare === undefined) reasons.push("who holds it is unknown");
	else if (facts.topHoldersShare > limits.maxTopHoldersShare)
		reasons.push(
			`the top holders own ${Math.round(facts.topHoldersShare * 100)}%, above the ${Math.round(limits.maxTopHoldersShare * 100)}% limit`,
		);

	if (facts.holders === undefined) reasons.push("how many hold it is unknown");
	else if (facts.holders < limits.minHolders)
		reasons.push(`only ${facts.holders} holders, below the ${limits.minHolders} minimum`);

	if (facts.ageHours === undefined) reasons.push("its age is unknown");
	else if (facts.ageHours < limits.minAgeHours)
		reasons.push(
			`it is ${Math.round(facts.ageHours)} hours old, younger than ${limits.minAgeHours} hours`,
		);

	const worst = Math.max(facts.buyImpactPct ?? Number.NaN, facts.sellImpactPct ?? Number.NaN);
	if (facts.buyImpactPct === undefined || facts.sellImpactPct === undefined)
		reasons.push("what a trade would cost in price impact is unknown");
	else if (worst > limits.maxImpactPct) {
		const side = (facts.sellImpactPct ?? 0) >= (facts.buyImpactPct ?? 0) ? "selling" : "buying";
		reasons.push(`${side} would move the price ${worst}%, above the ${limits.maxImpactPct}% limit`);
	}

	return { passed: reasons.length === 0, reasons };
}
