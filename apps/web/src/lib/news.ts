/**
 * The news, as the gateway gathers it from the publishers' feeds. Fetched whole and narrowed here, so the
 * rail can list every source and moving between them is instant.
 */

import { useQuery } from "@tanstack/react-query";
import type { Api } from "./api.ts";
import { ApiError } from "./machines.ts";

export type NewsItem = {
	id: string;
	title: string;
	link: string;
	source: string;
	publishedAt: string;
	summary?: string;
	image?: string;
	solana: boolean;
};
type NewsResponse = { items: NewsItem[]; fetchedAt: string };

export type NewsFilter = { kind: "all" } | { kind: "solana" } | { kind: "source"; source: string };

/** How long ago, the way people say it; past a week, the date. */
export function ago(iso: string, now: Date = new Date()): string {
	const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
	const say = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"} ago`;
	if (seconds < 60) return "just now";
	if (seconds < 3600) return say(Math.floor(seconds / 60), "minute");
	if (seconds < 86_400) return say(Math.floor(seconds / 3600), "hour");
	if (seconds < 7 * 86_400) return say(Math.floor(seconds / 86_400), "day");
	return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Every source in the news, the one with the most stories first. */
export function sourcesOf(items: NewsItem[]): string[] {
	const counts = new Map<string, number>();
	for (const item of items) counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}

export function picked(items: NewsItem[], filter: NewsFilter): NewsItem[] {
	if (filter.kind === "solana") return items.filter((each) => each.solana);
	if (filter.kind === "source") return items.filter((each) => each.source === filter.source);
	return items;
}

/** The latest news. The gateway reads the feeds every few minutes, so asking more often gains nothing. */
export function useNews(api: Api) {
	return useQuery({
		queryKey: ["news"],
		staleTime: 60_000,
		refetchInterval: 5 * 60_000,
		queryFn: async () => {
			const response = await api.v1.news.$get({ query: {} });
			if (!response.ok)
				throw new ApiError(`The news answered ${response.status}.`, response.status);
			return (await response.json()) as NewsResponse;
		},
	});
}
