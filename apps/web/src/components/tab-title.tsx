import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchPrice, type Price } from "../lib/price.ts";

/** What the browser tab says: the live SOL price and which way it moved, so the tab is a ticker too. */
export function tabTitle(price: Price | undefined): string {
	if (!price) return "MASCHINA";
	const arrow = price.change24h > 0 ? " ▲" : price.change24h < 0 ? " ▼" : "";
	return `${price.usd.toFixed(2)}${arrow} SOL · MASCHINA`;
}

export function TabTitle() {
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});
	useEffect(() => {
		document.title = tabTitle(price.data);
	}, [price.data]);
	return null;
}
