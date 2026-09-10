/**
 * The window's only route to the log.
 *
 * `ADR-005` and `06-NODES` §3: the desktop application holds no database
 * connection and never will. It reads through the control plane over HTTP, which
 * is the same boundary a worker crosses, and `check-node-boundary.mjs` fails the
 * build if this package ever imports `@maschina/db` or `pg`.
 *
 * **The window never appends to the log.** There is no append here and there
 * never will be: a viewer that can write to the event log is not a viewer
 * (`02-CORE` §3.5).
 *
 * It does now carry one named effect. Answering a suspended worker is not a
 * write to the log, it is asking the control plane to record a person's decision,
 * which the control plane does under that person's name. `07-CONTEXT-MEMORY` §2
 * is the reason it belongs here at all: the same words in a forge comment are
 * untrusted content, and arriving through Maschina from an identified human makes
 * them instruction. Anything else that changes something arrives the same way, as
 * a named effect, never as a general write path.
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

/** A worker that has stopped, and what would start it again. */
export interface WireSuspension {
	readonly worker: string;
	readonly objective: string | null;
	/** `question` waits on a person. `until` waits on a clock. */
	readonly kind: string;
	readonly reason: string;
	readonly resumeAt: string | null;
	readonly question: string | null;
	readonly since: string;
}

export function suspensions(): Promise<Result<WireSuspension[]>> {
	return read<WireSuspension[]>("/suspensions");
}

/**
 * Answer a suspended worker.
 *
 * The one operation on this surface that changes anything. It writes nothing to
 * the log itself: it asks the control plane to record that a person answered,
 * and the control plane records who.
 */
export async function answer(
	worker: string,
	objective: string | null,
	because: string,
	answeredBy: string,
): Promise<Result<{ resumed: boolean }>> {
	const where = base();
	try {
		const response = await fetch(`${where}/suspensions/${encodeURIComponent(worker)}/resume`, {
			method: "POST",
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ because, objective, answeredBy }),
		});
		if (!response.ok) {
			const detail = (await response.json().catch(() => ({}))) as { error?: string };
			return {
				ok: false,
				problem: detail.error ?? `The control plane refused the answer (${response.status}).`,
			};
		}
		return { ok: true, value: (await response.json()) as { resumed: boolean } };
	} catch {
		// An answer that did not arrive must not look like one that did. The
		// worker is still stopped and the person needs to know that.
		return {
			ok: false,
			problem: `The answer did not reach ${where}. The worker is still stopped.`,
		};
	}
}

export const controlPlaneUrl = base;
