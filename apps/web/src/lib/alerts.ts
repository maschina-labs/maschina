import type { ActivityEntry } from "./portfolio.ts";

/**
 * Which moments deserve your attention, out of everything machines record: money moving, things going
 * wrong, machines stopping. Routine runs that did nothing are left out, because an alert that fires all
 * the time is one people learn to ignore.
 */
const WORTH_TELLING = new Set([
	"trade.completed",
	"trade.failed",
	"trade.refused",
	"machine.paused",
	"machine.stopped",
	"withdrawal.completed",
	"withdrawal.failed",
	"sweep.completed",
]);

export function alertsFrom(feed: ActivityEntry[]): ActivityEntry[] {
	return feed.filter((entry) => WORTH_TELLING.has(entry.type));
}

/** How many alerts arrived after you last looked. */
export function unread(alerts: ActivityEntry[], seenAt: string | undefined): number {
	if (!seenAt) return alerts.length;
	return alerts.filter((alert) => alert.occurredAt > seenAt).length;
}

const SEEN = "maschina.alerts.seen";

/** When you last looked, remembered in this browser only; it may be missing or unreadable, and that is fine. */
export function lastSeen(): string | undefined {
	try {
		return localStorage.getItem(SEEN) ?? undefined;
	} catch {
		return undefined;
	}
}

export function markSeen(at: string): void {
	try {
		localStorage.setItem(SEEN, at);
	} catch {
		// Private windows and blocked storage just mean the count starts over next time.
	}
}
