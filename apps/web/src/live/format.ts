/**
 * Amounts on the record are whole numbers of the smallest unit (USDC has six decimals, SOL nine). They are written
 * with integer arithmetic, so a large or odd amount never loses a digit to a float.
 */
export function amount(smallest: string, decimals: number): string {
	const whole = BigInt(smallest);
	const unit = 10n ** BigInt(decimals);
	const fraction = (whole % unit).toString().padStart(decimals, "0").replace(/0+$/, "");
	return fraction ? `${whole / unit}.${fraction}` : `${whole / unit}`;
}

/** USDC per SOL for one trade, to the cent, or nothing when no SOL moved. */
export function priceOf(usdc: string, sol: string): string | undefined {
	const lamports = BigInt(sol);
	if (lamports === 0n) return undefined;
	// usdc has 6 decimals and sol 9, so usdc * 10^9 / sol is the price in millionths; round to cents.
	const millionths = (BigInt(usdc) * 10n ** 9n) / lamports;
	const cents = (millionths + 5000n) / 10000n;
	return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}
