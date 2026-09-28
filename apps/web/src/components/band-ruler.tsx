/**
 * The machine's band as a ruler: ticks from a little above its sell line down to a little below its buy
 * line, the two lines marked, and the live price as the one lit tick that moves with every trade. The
 * scroll ruler's idea, used where it means something: where the market sits in the machine's range.
 */

const TICKS = 41;
/** How far past each line the ruler runs, as a share of the band, so a price just outside still shows. */
const MARGIN = 0.25;

/** Which tick a price lands on, 0 at the top (above sell) and TICKS - 1 at the bottom (below buy). */
export function tickOf(price: number, buy: number, sell: number): number {
	const room = sell - buy;
	if (!(room > 0)) return Math.floor(TICKS / 2);
	const top = sell + room * MARGIN;
	const bottom = buy - room * MARGIN;
	const along = (top - price) / (top - bottom);
	return Math.round(Math.min(1, Math.max(0, along)) * (TICKS - 1));
}

export function BandRuler({
	buy,
	sell,
	price,
}: {
	buy: number;
	sell: number;
	price: number | undefined;
}) {
	const sellAt = tickOf(sell, buy, sell);
	const buyAt = tickOf(buy, buy, sell);
	const at = price === undefined ? undefined : tickOf(price, buy, sell);
	return (
		<div
			role="img"
			aria-label={`Band from ${buy.toFixed(2)} to ${sell.toFixed(2)}`}
			className="flex h-full w-24 flex-col justify-between py-2"
		>
			{Array.from({ length: TICKS }, (_, index) => {
				const live = index === at;
				const line = index === sellAt ? "SELL" : index === buyAt ? "BUY" : undefined;
				const inside = index >= sellAt && index <= buyAt;
				const width = live ? 28 : line ? 18 : inside ? 10 : 6;
				const alpha = live ? 0.95 : line ? 0.6 : inside ? 0.22 : 0.1;
				return (
					// The ticks never reorder, so their place is their identity.
					// biome-ignore lint/suspicious/noArrayIndexKey: see above
					<div key={index} className="flex h-px items-center gap-2">
						<span
							className="block h-px shrink-0 transition-[width,background-color] duration-150"
							style={{ width, backgroundColor: `oklch(1 0 0 / ${alpha})` }}
						/>
						{live && price !== undefined ? (
							<span className="text-[10px] text-neutral-100 tabular-nums">{price.toFixed(2)}</span>
						) : line ? (
							<span className="text-[9.5px] text-neutral-500 tracking-[0.12em]">
								{line} {(line === "SELL" ? sell : buy).toFixed(2)}
							</span>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
