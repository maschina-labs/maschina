import type { ActivityEntry } from "./portfolio.ts";

/** The kinds of thing a feed can be narrowed to. */
export const KINDS = ["ALL", "TRADES", "PROBLEMS", "MACHINE"] as const;
export type Kind = (typeof KINDS)[number];

const IN: Record<Exclude<Kind, "ALL">, (type: string) => boolean> = {
	TRADES: (type) =>
		type.startsWith("trade.") && type !== "trade.refused" && type !== "trade.failed",
	PROBLEMS: (type) =>
		type === "trade.refused" ||
		type === "trade.failed" ||
		type === "run.skipped" ||
		type.endsWith(".failed"),
	MACHINE: (type) => type.startsWith("machine."),
};

export function filterActivity(
	feed: ActivityEntry[],
	kind: Kind,
	machineId?: string,
): ActivityEntry[] {
	return feed.filter(
		(entry) =>
			(kind === "ALL" || IN[kind](entry.type)) &&
			(machineId === undefined || entry.machineId === machineId),
	);
}

/** The feed in days, newest day first, each day's entries in the order given. Days are the viewer's. */
export function byDay(feed: ActivityEntry[]): { day: string; entries: ActivityEntry[] }[] {
	const days = new Map<string, ActivityEntry[]>();
	for (const entry of feed) {
		const day = new Date(entry.occurredAt)
			.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
			.toUpperCase();
		days.set(day, [...(days.get(day) ?? []), entry]);
	}
	return [...days].map(([day, entries]) => ({ day, entries }));
}
