import { amount, type MachineSummary } from "../lib/machines.ts";

/**
 * A slow scrolling strip under the header: machines and their results, like a stock ticker. Yours for now;
 * the top machines on Maschina, anonymous, once the backend streams them. It pauses under the pointer.
 */
export function TickerView({
	machines,
	price,
}: {
	machines: MachineSummary[];
	price: number | undefined;
}) {
	const items = [
		`SOL ${price === undefined ? "-" : price.toFixed(2)}`,
		...machines.map((machine) => {
			const realised = amount(machine.result.realised);
			return `${machine.name.toUpperCase()} ${realised.startsWith("-") ? "" : "+"}${realised}`;
		}),
	];
	// Twice over, so the strip loops without a gap.
	const loop = [...items, ...items];
	return (
		<div
			role="marquee"
			aria-label="Ticker"
			className="group relative h-6 shrink-0 overflow-hidden bg-[oklch(1_0_0/0.025)]"
		>
			<div className="flex h-full w-max animate-[ticker_60s_linear_infinite] items-center gap-10 px-4 group-hover:[animation-play-state:paused]">
				{loop.map((item, index) => (
					// The same items repeat on purpose, so their place is what tells them apart.
					// biome-ignore lint/suspicious/noArrayIndexKey: see above
					<span
						key={index}
						className="whitespace-nowrap text-[10px] text-neutral-400 tabular-nums tracking-[0.14em]"
					>
						{item}
					</span>
				))}
			</div>
		</div>
	);
}
