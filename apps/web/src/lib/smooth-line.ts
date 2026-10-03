/**
 * A smooth line through points, for charts where corners would lie.
 *
 * Monotone cubic (Fritsch and Carlson): the curve passes through every point and never bulges past one,
 * so between two sales it can't show a profit higher or lower than either. An ordinary smooth curve
 * overshoots at every turn, and on a profit chart an overshoot is a number that never happened.
 */

export type Pt = { x: number; y: number };

export function smoothPath(points: Pt[]): string {
	if (points.length === 0) return "";
	const [first] = points as [Pt];
	if (points.length === 1) return `M${first.x},${first.y}`;
	const n = points.length;
	const dx: number[] = [];
	const slope: number[] = [];
	for (let i = 0; i < n - 1; i += 1) {
		const a = points[i] as Pt;
		const b = points[i + 1] as Pt;
		dx.push(b.x - a.x);
		slope.push(b.x === a.x ? 0 : (b.y - a.y) / (b.x - a.x));
	}
	// The tangent at each point: zero at a peak or a trough, a weighted mean of the slopes either side otherwise.
	const tangent: number[] = [slope[0] ?? 0];
	for (let i = 1; i < n - 1; i += 1) {
		const before = slope[i - 1] ?? 0;
		const after = slope[i] ?? 0;
		if (before * after <= 0) tangent.push(0);
		else {
			const w1 = 2 * (dx[i] ?? 0) + (dx[i - 1] ?? 0);
			const w2 = (dx[i] ?? 0) + 2 * (dx[i - 1] ?? 0);
			tangent.push((w1 + w2) / (w1 / before + w2 / after));
		}
	}
	tangent.push(slope[n - 2] ?? 0);
	let d = `M${first.x},${first.y}`;
	for (let i = 0; i < n - 1; i += 1) {
		const a = points[i] as Pt;
		const b = points[i + 1] as Pt;
		const third = (dx[i] ?? 0) / 3;
		d += ` C${a.x + third},${a.y + (tangent[i] ?? 0) * third} ${b.x - third},${b.y - (tangent[i + 1] ?? 0) * third} ${b.x},${b.y}`;
	}
	return d;
}

/** Round numbers for an axis between two values: three to five steps that a person would choose. */
export function niceTicks(low: number, high: number, count = 4): number[] {
	if (low === high) return [low];
	const raw = (high - low) / count;
	const power = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
	const ticks: number[] = [];
	for (let t = Math.ceil(low / step) * step; t <= high + step / 1e6; t += step)
		ticks.push(Number(t.toFixed(10)));
	return ticks;
}

/**
 * A softer line, for a running total that only moves at moments: a B-spline, which bends gently through
 * the neighbourhood of each point instead of turning sharply at it, and never strays outside the points
 * around it. It starts at the first point and ends at the last exactly, so where it begins and where it
 * stands now are both true.
 */
export function softPath(points: Pt[]): string {
	if (points.length < 3) return smoothPath(points);
	// The ends repeated, so the curve is pinned to the first and the last points.
	const p = [points[0], points[0], ...points, points.at(-1), points.at(-1)] as Pt[];
	const first = points[0] as Pt;
	let d = `M${first.x},${first.y}`;
	for (let i = 1; i < p.length - 2; i += 1) {
		const b = p[i] as Pt;
		const c = p[i + 1] as Pt;
		const e = p[i + 2] as Pt;
		const c1x = (2 * b.x + c.x) / 3;
		const c1y = (2 * b.y + c.y) / 3;
		const c2x = (b.x + 2 * c.x) / 3;
		const c2y = (b.y + 2 * c.y) / 3;
		const endX = (b.x + 4 * c.x + e.x) / 6;
		const endY = (b.y + 4 * c.y + e.y) / 6;
		d += ` C${c1x},${c1y} ${c2x},${c2y} ${endX},${endY}`;
	}
	return d;
}
