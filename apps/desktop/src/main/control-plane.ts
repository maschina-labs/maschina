/**
 * The window's only route to the log.
 *
 * `ADR-005` and `06-NODES` §3: the desktop application holds no database
 * connection and never will. It reads through the control plane over HTTP, which
 * is the same boundary a worker crosses, and `check-node-boundary.mjs` fails the
 * build if this package ever imports `@maschina/db` or `pg`.
 *
 * **This surface is read-only, permanently.** There is no append here and there
 * is no write path. A viewer that can write to the event log is not a viewer
 * (`02-CORE` §3.5). Operations that change something arrive later as named
 * effects with their own authority, not by widening this file.
 *
 * Failure is reported, never swallowed. A window that silently shows nothing when
 * the control plane is gone is indistinguishable from a window showing that
 * nothing has happened, and those two mean opposite things.
 */

/**
 * Read per call rather than captured at module load, so the address can change
 * without reloading the process. It also means a test can point this somewhere
 * else without importing the module twice, which is the kind of thing that ends
 * up as a cache-busting query string nobody can explain later.
 */
function base(): string {
	return process.env.MASCHINA_CONTROL_PLANE_URL ?? "http://127.0.0.1:8787";
}

/** How long to wait before deciding the control plane is not there. */
const TIMEOUT_MS = 4_000;

export interface Unreachable {
	readonly ok: false;
	/** Said to a person, so it says what to do rather than what threw. */
	readonly problem: string;
}

export type Result<T> = { readonly ok: true; readonly value: T } | Unreachable;

async function read<T>(path: string): Promise<Result<T>> {
	const where = base();
	const url = `${where}${path}`;
	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { accept: "application/json" },
		});
		if (!response.ok) {
			return {
				ok: false,
				problem: `The control plane answered ${response.status} for ${path}.`,
			};
		}
		return { ok: true, value: (await response.json()) as T };
	} catch (error: unknown) {
		// Distinguishing these matters to whoever reads the message. "Not running"
		// and "running but wedged" have different fixes.
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		return {
			ok: false,
			problem: timedOut
				? `The control plane at ${where} did not answer within ${TIMEOUT_MS / 1000} seconds.`
				: `Nothing is listening at ${where}. Start it with: pnpm dev`,
		};
	}
}

/** One event, as the control plane serves it. Ids are strings on the wire. */
export interface WireEvent {
	readonly id: string;
	readonly recordedAt: string;
	readonly actor: string;
	readonly objective: string | null;
	readonly type: string;
	readonly epoch: string;
	readonly payload: Record<string, unknown>;
}

export interface LogQuery {
	readonly objective?: string;
	readonly actor?: string;
	readonly limit?: number;
}

export function events(query: LogQuery = {}): Promise<Result<WireEvent[]>> {
	const search = new URLSearchParams();
	if (query.objective !== undefined) search.set("objective", query.objective);
	if (query.actor !== undefined) search.set("actor", query.actor);
	search.set("limit", String(query.limit ?? 200));
	return read<WireEvent[]>(`/events?${search.toString()}`);
}

export function health(): Promise<Result<{ ok: boolean }>> {
	return read<{ ok: boolean }>("/health");
}

/** One criterion of a completion contract. `09-EVALUATION` §2. */
export interface WireCriterion {
	readonly id: string;
	readonly criterion: string;
	readonly verifyBy: string;
	readonly strength: string;
	readonly evidence: readonly string[];
}

export interface WireObjective {
	readonly id: string;
	readonly statement: string;
	readonly origin: string;
	readonly parent: string | null;
	readonly state: string;
	/** Recorded at admission and never recomputed. Null until admitted. */
	readonly contractHash: string | null;
	readonly refusedBecause?: string | null;
	readonly contract: {
		readonly criteria: readonly WireCriterion[];
		readonly nonGoals: readonly string[];
		readonly failureConditions: readonly string[];
	};
}

export function objectives(): Promise<Result<WireObjective[]>> {
	return read<WireObjective[]>("/objectives");
}

export function objective(id: string): Promise<Result<WireObjective>> {
	return read<WireObjective>(`/objectives/${encodeURIComponent(id)}`);
}

export const controlPlaneUrl = base;
