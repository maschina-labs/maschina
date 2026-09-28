import { amount, type MachineDetail } from "./machines.ts";

/** One line on what a machine is doing right now, from its state, settings and what it holds. */
export function statusOf(machine: MachineDetail): string {
	if (machine.state !== "running") return machine.state.toUpperCase();
	const buy = machine.settings["buyLevel"];
	const sell = machine.settings["sellLevel"];
	if (typeof buy !== "string" || typeof sell !== "string") return "RUNNING";
	return BigInt(machine.result.position) > 0n
		? `HOLDING · SELLS AT ${amount(sell)}`
		: `WAITING TO BUY AT ${amount(buy)}`;
}

/** The band a range machine trades, as prices, for drawing on the chart. */
export function bandOf(machine: MachineDetail): { price: number; label: string }[] {
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
