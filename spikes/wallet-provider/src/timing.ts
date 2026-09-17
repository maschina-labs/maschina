/** Timing helpers for the provider comparison (#26). */

export type TimingSummary = { runs: number; minMs: number; medianMs: number; maxMs: number };

export function summarize(times: number[]): TimingSummary {
	if (times.length === 0) throw new Error("no timings to summarize");
	const sorted = [...times].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	const median =
		sorted.length % 2 === 1
			? (sorted[middle] as number)
			: ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
	return {
		runs: sorted.length,
		minMs: Math.round(sorted[0] as number),
		medianMs: Math.round(median),
		maxMs: Math.round(sorted.at(-1) as number),
	};
}

/** Runs `step` `runs` times in a row, so runs don't slow each other down, and returns each duration. */
export async function timeEach(
	runs: number,
	step: (index: number) => Promise<unknown>,
	now: () => number = () => performance.now(),
): Promise<number[]> {
	const times: number[] = [];
	for (let i = 0; i < runs; i++) {
		const started = now();
		await step(i);
		times.push(now() - started);
	}
	return times;
}
