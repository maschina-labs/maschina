import { useQuery } from "@tanstack/react-query";
import { fetchPrice, type Price } from "../lib/price.ts";

const usd = (n: number) =>
	n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** A white triangle says which way, so the number itself carries no sign. */
const delta = (n: number) => (n > 0 ? "▲" : n < 0 ? "▼" : "");

export function SolPriceView({ price }: { price: Price | undefined }) {
	return (
		<div className="flex items-baseline gap-4">
			<span className="text-[11px] text-neutral-500 tracking-[0.14em]">SOL / USD</span>
			<span className="font-medium text-[34px] text-neutral-100 tabular-nums tracking-tight sm:text-[40px]">
				{price ? usd(price.usd) : "…"}
			</span>
			{price ? (
				<span className="flex items-baseline gap-1.5 text-[12px] text-neutral-500 tabular-nums">
					<span className="text-[10px] text-neutral-100">{delta(price.change24h)}</span>
					{Math.abs(price.change24h).toFixed(2)}% 24H
				</span>
			) : null}
		</div>
	);
}

/** Refreshed every five seconds: often enough to feel live, gently enough for a free API. */
export function SolPrice() {
	const { data } = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});
	return <SolPriceView price={data} />;
}
