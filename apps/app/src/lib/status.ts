import { followingRange, type RememberedEvent } from "@maschina/runtime";
import { amount, type MachineDetail, type RecordEntry } from "./machines.ts";

const LABELS: Record<string, string> = {
	sell: "SELL",
	floor: "FLOOR",
	buy: "BUY",
	follow: "FOLLOW",
};

/**
 * Where a following machine's band sits right now: as the API sends it, or worked out from the record the
 * same way the server works it out, so the chart and the watcher never disagree.
 */
function followingLevels(machine: MachineDetail, record: readonly RecordEntry[]) {
	if (machine.kind !== followingRange.kind) return undefined;
	// The API works the band out from the whole record; the app only has part of it. What the API sends
	// wins, and the record is read only when talking to an API from before it sent levels.
	const sent = (machine as { levels?: { id: string; price: string }[] }).levels;
	if (sent)
		return sent
			.map((level) => ({
				id: level.id,
				price: Number(level.price) / 1_000_000,
				label: LABELS[level.id] ?? level.id.toUpperCase(),
			}))
			.sort((a, b) => b.price - a.price);
	const read = followingRange.readSettings(machine.settings);
	if (!read.ok) return [];
	// The record arrives newest first; the band is worked out from the oldest.
	const events = [...record]
		.reverse()
		.map(
			(entry) =>
				({ ...entry, occurredAt: new Date(entry.occurredAt) }) as unknown as RememberedEvent,
		);
	return (
		(followingRange.levels?.(read.value, { events, now: new Date() }) ?? [])
			.map((level) => ({
				id: level.id,
				price: Number(level.level) / 1_000_000,
				label: LABELS[level.id] ?? level.id.toUpperCase(),
			}))
			// Highest first, the way the fixed band is drawn.
			.sort((a, b) => b.price - a.price)
	);
}

/** One line on what a machine is doing right now, from its state, settings and what it holds. */
export function statusOf(machine: MachineDetail, record: readonly RecordEntry[] = []): string {
	if (machine.state !== "running") return machine.state.toUpperCase();
	const following = followingLevels(machine, record);
	if (following) {
		const sell = following.find((level) => level.id === "sell");
		const buy = following.find((level) => level.id === "buy");
		if (sell) return `HOLDING · SELLS AT ${sell.price.toFixed(2)}`;
		if (buy) return `WAITING TO BUY AT ${buy.price.toFixed(2)}`;
		return "RUNNING";
	}
	const buy = machine.settings["buyLevel"];
	const sell = machine.settings["sellLevel"];
	if (typeof buy !== "string" || typeof sell !== "string") return "RUNNING";
	return BigInt(machine.result.position) > 0n
		? `HOLDING · SELLS AT ${amount(sell)}`
		: `WAITING TO BUY AT ${amount(buy)}`;
}

/** The band a range machine trades, as prices, for drawing on the chart. */
export function bandOf(
	machine: MachineDetail,
	record: readonly RecordEntry[] = [],
): { price: number; label: string }[] {
	const following = followingLevels(machine, record);
	if (following) return following.map(({ price, label }) => ({ price, label }));
	const levels: { price: number; label: string }[] = [];
	for (const [key, label] of [
		["sellLevel", "SELL"],
		["buyLevel", "BUY"],
	] as const) {
		const value = machine.settings[key];
		if (typeof value === "string" && /^\d+$/.test(value))
			levels.push({ price: Number(value) / 1_000_000, label });
	}
	return levels;
}
