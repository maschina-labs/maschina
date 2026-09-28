import type { Alert } from "@maschina/contracts";

/**
 * An alert as a message a person reads on their phone: one or two short plain sentences. Amounts are
 * turned from each token's smallest unit into the numbers people know, to the precision that matters.
 */

const TOKENS: Record<string, { symbol: string; decimals: number }> = {
	EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", decimals: 6 },
	So11111111111111111111111111111111111111112: { symbol: "SOL", decimals: 9 },
};

const DOLLARS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const tokenOf = (mint: string) => TOKENS[mint] ?? { symbol: `${mint.slice(0, 4)}…`, decimals: 0 };
const quantity = (amount: string, mint: string) => {
	const { decimals } = tokenOf(mint);
	return Number(amount) / 10 ** decimals;
};
const shown = (amount: string, mint: string) => {
	const { symbol, decimals } = tokenOf(mint);
	return `${quantity(amount, mint).toFixed(decimals >= 9 ? 4 : 2)} ${symbol}`;
};
const signedDollars = (micros: string) => {
	const value = Number(micros) / 1_000_000;
	return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(2)} USDC`;
};

export function alertText(alert: Alert): string {
	const name = alert.machineName;
	const why = alert.reason ? ` ${alert.reason}.` : "";
	switch (alert.type) {
		case "trade.completed": {
			if (!alert.trade) return `${name} made a trade.`;
			const { inputMint, outputMint, inputAmount, outputAmount } = alert.trade;
			const buying = inputMint === DOLLARS;
			const base = buying ? outputMint : inputMint;
			const dollars = buying ? inputAmount : outputAmount;
			const baseAmount = buying ? outputAmount : inputAmount;
			const price = quantity(dollars, DOLLARS) / quantity(baseAmount, base);
			const trade = buying
				? `${name} bought ${shown(baseAmount, base)} at ${price.toFixed(2)} for ${shown(dollars, DOLLARS)}.`
				: `${name} sold ${shown(baseAmount, base)} at ${price.toFixed(2)} for ${shown(dollars, DOLLARS)}.`;
			return alert.realised === undefined || buying
				? trade
				: `${trade} Realised so far: ${signedDollars(alert.realised)}.`;
		}
		case "trade.failed":
			return `${name} tried to trade and it failed.${why}`;
		case "trade.refused":
			return `${name} was refused a trade.${why}`;
		case "machine.paused":
			return `${name} paused itself.${why} It waits for you now.`;
		case "machine.stopped":
			return `${name} stopped.${why}`;
		case "withdrawal.completed":
			return `${name} sent its money back to your wallet.`;
		case "withdrawal.failed":
			return `${name} could not send its money back.${why}`;
		case "sweep.completed":
			return `${name} banked profit in its vault, where it can never be traded.`;
		default:
			return `${name}: ${alert.type}.`;
	}
}
