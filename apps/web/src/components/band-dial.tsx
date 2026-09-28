/**
 * The machine's band as a dial, in the language of Ash's circular HUD references: an arc from the buy line
 * round to the sell line, tick marks along it, a dashed orbit outside, and a needle at the live price. The
 * price sits in the middle in large numerals, with small technical labels around it.
 */

const SIZE = 320;
const C = SIZE / 2;
const R = 118;
/** The arc runs 240 degrees, open at the bottom, like a gauge. */
const START = 150;
const SWEEP = 240;
/** How far past each line the dial runs, as a share of the band, so a price just outside still shows. */
const MARGIN = 0.3;

/** Where a price sits along the dial, 0 at its start and 1 at its end. */
export function dialPlace(price: number, buy: number, sell: number): number {
	const room = sell - buy;
	if (!(room > 0)) return 0.5;
	const low = buy - room * MARGIN;
	const high = sell + room * MARGIN;
	return Math.min(1, Math.max(0, (price - low) / (high - low)));
}

/** How far through the band the price is, as a whole percentage, held to 0 to 100. */
export function inBand(price: number, buy: number, sell: number): number {
	if (!(sell > buy)) return 0;
	return Math.round(Math.min(1, Math.max(0, (price - buy) / (sell - buy))) * 100);
}

const point = (place: number, radius: number) => {
	const angle = ((START + place * SWEEP) * Math.PI) / 180;
	return [C + radius * Math.cos(angle), C + radius * Math.sin(angle)] as const;
};

function arc(from: number, to: number, radius: number) {
	const [x1, y1] = point(from, radius);
	const [x2, y2] = point(to, radius);
	const large = (to - from) * SWEEP > 180 ? 1 : 0;
	return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

export function BandDial({
	buy,
	sell,
	price,
}: {
	buy: number;
	sell: number;
	price: number | undefined;
}) {
	const at = price === undefined ? undefined : dialPlace(price, buy, sell);
	const buyAt = dialPlace(buy, buy, sell);
	const sellAt = dialPlace(sell, buy, sell);
	const ticks = 60;
	return (
		<svg
			viewBox={`0 0 ${SIZE} ${SIZE}`}
			role="img"
			aria-label={`Band from ${buy.toFixed(2)} to ${sell.toFixed(2)}`}
			className="h-full w-full"
		>
			{/* The orbit: a dashed ring outside the dial. */}
			<circle
				cx={C}
				cy={C}
				r={R + 26}
				fill="none"
				stroke="oklch(1 0 0 / 0.14)"
				strokeDasharray="2 5"
			/>
			{/* The track, and the band itself brighter along it. */}
			<path d={arc(0, 1, R)} fill="none" stroke="oklch(1 0 0 / 0.12)" strokeWidth={1} />
			<path d={arc(buyAt, sellAt, R)} fill="none" stroke="oklch(1 0 0 / 0.55)" strokeWidth={2} />
			{Array.from({ length: ticks + 1 }, (_, index) => {
				const place = index / ticks;
				const inside = place >= buyAt && place <= sellAt;
				const long = index % 5 === 0;
				const [x1, y1] = point(place, R + 5);
				const [x2, y2] = point(place, R + (long ? 13 : 9));
				// biome-ignore lint/suspicious/noArrayIndexKey: ticks never reorder
				return (
					<line
						key={index}
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						stroke={`oklch(1 0 0 / ${inside ? 0.5 : 0.15})`}
						strokeWidth={1}
					/>
				);
			})}
			{(
				[
					[buyAt, "BUY", buy],
					[sellAt, "SELL", sell],
				] as const
			).map(([place, label, value]) => {
				const [x, y] = point(place, R - 18);
				const [mx1, my1] = point(place, R - 6);
				const [mx2, my2] = point(place, R + 16);
				return (
					<g key={label}>
						<line
							x1={mx1}
							y1={my1}
							x2={mx2}
							y2={my2}
							stroke="oklch(1 0 0 / 0.8)"
							strokeWidth={1.5}
						/>
						<text
							x={x}
							y={y}
							textAnchor="middle"
							fill="oklch(1 0 0 / 0.5)"
							fontSize={7.5}
							letterSpacing={1.2}
						>
							{label} {value.toFixed(2)}
						</text>
					</g>
				);
			})}
			{at !== undefined
				? (() => {
						const [nx1, ny1] = point(at, R - 30);
						const [nx2, ny2] = point(at, R + 20);
						const [dx, dy] = point(at, R + 26);
						return (
							<g aria-label="The price">
								<line
									x1={nx1}
									y1={ny1}
									x2={nx2}
									y2={ny2}
									stroke="oklch(0.97 0 0)"
									strokeWidth={1.5}
								/>
								<circle cx={dx} cy={dy} r={3} fill="oklch(0.97 0 0)" />
							</g>
						);
					})()
				: null}
			<text
				x={C}
				y={C - 30}
				textAnchor="middle"
				fill="oklch(1 0 0 / 0.45)"
				fontSize={7.5}
				letterSpacing={1.5}
			>
				{"SOL_USD // LIVE"}
			</text>
			<text
				x={C}
				y={C + 12}
				textAnchor="middle"
				fill="oklch(0.97 0 0)"
				fontSize={40}
				letterSpacing={-0.5}
			>
				{price === undefined ? "- - -" : price.toFixed(2)}
			</text>
			<text
				x={C}
				y={C + 34}
				textAnchor="middle"
				fill="oklch(1 0 0 / 0.45)"
				fontSize={7.5}
				letterSpacing={1.5}
			>
				{price === undefined ? "WAITING" : `IN_BAND ${inBand(price, buy, sell)}%`}
			</text>
		</svg>
	);
}
