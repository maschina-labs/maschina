import { useEffect, useState } from "react";
import { compactUsd, type Day, streamDay } from "../lib/market.ts";

export function MarketStripView({ day, live }: { day: Day | undefined; live: boolean }) {
	const cell = "flex flex-col gap-1";
	const label = "text-[10px] text-neutral-500 tracking-[0.14em]";
	const value = "text-[12px] text-neutral-200 tabular-nums";
	return (
		<div className="flex flex-wrap items-end gap-x-8 gap-y-3">
			<div className={cell}>
				<span className={label}>24H HIGH</span>
				<span className={value}>{day ? day.high.toFixed(2) : "…"}</span>
			</div>
			<div className={cell}>
				<span className={label}>24H LOW</span>
				<span className={value}>{day ? day.low.toFixed(2) : "…"}</span>
			</div>
			<div className={cell}>
				<span className={label}>24H VOLUME</span>
				<span className={value}>{day ? `$${compactUsd(day.volumeUsd)}` : "…"}</span>
			</div>
			<span
				className={`ml-auto text-[10px] tracking-[0.14em] ${live ? "text-neutral-200" : "text-neutral-600"}`}
			>
				{live ? "LIVE" : "OFFLINE"}
			</span>
		</div>
	);
}

/** The day's high, low and volume, streamed, and whether the stream is up. */
export function MarketStrip({ symbol = "SOLUSDT" }: { symbol?: string }) {
	const [day, setDay] = useState<Day>();
	const [live, setLive] = useState(false);
	useEffect(() => streamDay(symbol, setDay, setLive), [symbol]);
	return <MarketStripView day={day} live={live} />;
}
