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

/** Something a worker wants to do that a person has to allow first. */
export interface WireApproval {
	readonly capabilityId: string;
	readonly holder: string;
	readonly operation: string;
	readonly target: string;
	/** `every_use` asks again next time. `first_use` unlocks it for good. */
	readonly approval: string;
	readonly resource: string;
	readonly scope: string;
	readonly operations: readonly string[];
	readonly askedAt: string;
}

export function approvals(): Promise<Result<WireApproval[]>> {
	return read<WireApproval[]>("/approvals");
}

/** Send anything that changes something. One helper, so there is one place to read. */
async function act<T>(path: string, body: unknown, whenGone: string): Promise<Result<T>> {
	const where = base();
	try {
		const response = await fetch(`${where}${path}`, {
			method: "POST",
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!response.ok) {
			const detail = (await response.json().catch(() => ({}))) as { error?: string };
			return {
				ok: false,
				problem: detail.error ?? `The control plane refused it (${response.status}).`,
			};
		}
		return { ok: true, value: (await response.json()) as T };
	} catch {
		return { ok: false, problem: whenGone };
	}
}

/**
 * Allow it, or refuse it.
 *
 * A refusal is recorded, not merely withheld. Invariant 14: denials are recorded
 * as prominently as uses, and "nobody approved it" and "a person said no" are
 * different facts.
 */
export function decide(
	capabilityId: string,
	granted: boolean,
	reason: string,
	approver: string,
): Promise<Result<{ granted: boolean }>> {
	return act(
		`/capabilities/${encodeURIComponent(capabilityId)}/approve`,
		{ granted, reason, approver },
		"The decision did not arrive. Nothing has been allowed or refused.",
	);
}

/**
 * Stop everything.
 *
 * Revokes the root, which takes every capability with it. `01-PRINCIPLES` P13
 * does not yield, and a stop only reachable from a terminal is not reachable
 * when it is needed.
 */
export function stopEverything(
	reason: string,
	actor: string,
): Promise<Result<{ stopped: boolean; revoked: string[] }>> {
	return act(
		"/emergency-stop",
		{ reason, actor },
		"The stop did not arrive, so assume nothing has stopped. Use: pnpm stop:test",
	);
}

/** One criterion, judged. `09-EVALUATION` §5. */
export interface WireVerdict {
	readonly criterionId: string;
	readonly result: string;
	/** What makes it checkable: artifact hashes, event ids, command output. */
	readonly evidence: readonly string[];
	/** Which verification strength was actually used, not which was asked for. */
	readonly method: string;
	readonly notes: string;
}

export interface WireEvaluation {
	readonly objective: string;
	readonly evaluator: string;
	readonly verdicts: readonly WireVerdict[];
	readonly rollup: string;
	readonly outcome: string;
	readonly remaining: readonly string[];
	readonly contractHash: string;
}

/** In micro-dollars of list value, which is the unit the log records. */
export interface WireCost {
	readonly resource: string;
	readonly settled: number;
	readonly calls: number;
}

export function evaluations(id: string): Promise<Result<WireEvaluation[]>> {
	return read<WireEvaluation[]>(`/objectives/${encodeURIComponent(id)}/evaluations`);
}

export function cost(id: string): Promise<Result<WireCost[]>> {
	return read<WireCost[]>(`/objectives/${encodeURIComponent(id)}/cost`);
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

/**
 * Be told when something is recorded.
 *
 * The window polled every two seconds, which is a question asked repeatedly by
 * something with no way of knowing the answer changed. This reads the control
 * plane's stream instead and calls back when the log gains something.
 *
 * Parsed by hand rather than with `EventSource`, which Node still marks
 * experimental. The format is three fields and a blank line; a dependency for
 * that would cost more than it saves.
 */
export function watch(
	onRecorded: () => void,
	onTrouble: (problem: string) => void,
): () => void {
	const controller = new AbortController();
	let closed = false;

	const run = async (): Promise<void> => {
		while (!closed) {
			try {
				const response = await fetch(`${base()}/events/stream`, {
					signal: controller.signal,
					headers: { accept: "text/event-stream" },
				});
				if (response.body === null) throw new Error("the stream had no body");

				onTrouble("");
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";

				while (!closed) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });

					// Messages are separated by a blank line. Anything after the last
					// one is a partial message and waits for the rest.
					const messages = buffer.split("\n\n");
					buffer = messages.pop() ?? "";
					for (const message of messages) {
						if (message.includes("event: recorded")) onRecorded();
					}
				}
			} catch {
				if (closed) return;
				// The control plane restarted, or the machine slept. Say so and try
				// again rather than going quiet, because a stream that died silently
				// looks exactly like a system where nothing is happening.
				onTrouble("Not being told about new events. Trying to reconnect.");
			}
			if (!closed) await new Promise((resolve) => setTimeout(resolve, 1_000));
		}
	};

	void run();
	return () => {
		closed = true;
		controller.abort();
	};
}

/**
 * State an objective.
 *
 * Admission is not a formality. An objective with no agreement about what done
 * means is refused, and the refusal is a list of what is wrong rather than an
 * error, because it is an answer (`09-EVALUATION` §2).
 */
export function state(
	statement: string,
	contract: unknown,
	origin: string,
): Promise<Result<{ objective: WireObjective; problems: string[] }>> {
	return act(
		"/objectives",
		{ statement, contract, origin },
		"The objective did not reach the control plane. Nothing was stated.",
	);
}

/**
 * The worker that drafts contracts.
 *
 * Named, because drafting is a model call and a model call is an effect that
 * something has to be authorised to perform (invariant 8: not free, not
 * special). Drafting with nothing granted is refused, and that refusal is
 * correct rather than an obstacle.
 */
export const DRAFTER = "worker:drafter";

/**
 * Ask the model what the contract should say.
 *
 * `15-OPEN-QUESTIONS` §5 lists "that contract authorship gets cheap enough to be
 * worth it" among the things this project is most likely wrong about. Every
 * contract so far was written by the person who already knew the answer, so this
 * is the first thing that tests it.
 *
 * **Nothing is admitted here.** The draft comes back as text for a person to
 * read, edit and accept. A contract accepted by somebody who did not read it is
 * not an agreement, and admitting on their behalf would make the frozen hash a
 * promise nobody made.
 */
export async function draft(
	statement: string,
	capabilityId: string,
): Promise<Result<{ text: string; cost: number }>> {
	const asked = await act<{ text: string; cost: number }>(
		"/model/invoke",
		{
			capabilityId,
			holder: DRAFTER,
			modelClass: "fast",
			prompt:
				"Somebody wants this done:\n\n" +
				`  ${statement}\n\n` +
				"Write the conditions that would have to be true for it to count as done. " +
				"For each one give a short id, the condition in one sentence, how it would be " +
				"checked, and whether checking it is mechanical (a machine verifies it against " +
				"something the worker does not control), independent (somebody who did not do " +
				"the work checks it), or judgement (an opinion). Prefer mechanical. Do not " +
				"invent conditions the statement does not imply.\n\n" +
				"Reply with JSON and nothing else, matching:\n" +
				'{"criteria":[{"id":"","criterion":"","verifyBy":"","strength":"mechanical",' +
				'"evidence":[""]}],"nonGoals":[""],"failureConditions":[""]}',
		},
		"The draft request did not arrive. Nothing was spent.",
	);
	return asked;
}

/** Every model capability somebody could draft with, so the window can say what is missing. */
export async function modelCapabilities(): Promise<Result<{ id: string; holder: string }[]>> {
	const all =
		await read<{ id: string; holder: string; resource: string; status: string }[]>(
			"/capabilities",
		);
	if (!all.ok) return all;
	return {
		ok: true,
		value: all.value
			.filter((c) => c.resource === "model" && c.status === "active")
			.map((c) => ({ id: c.id, holder: c.holder })),
	};
}
