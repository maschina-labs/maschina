/**
 * Preload. The only bridge between the renderer and the main process.
 *
 * Everything the renderer can do lives in this file. That is deliberate: it
 * makes the renderer's total authority readable in one place, which is the same
 * test 05-CAPABILITIES §0 applies to workers. Can you answer "what is the worst
 * this can do" by reading a data structure rather than the whole codebase?
 *
 * At this step the answer is: read the app version. Nothing else.
 *
 * Rules for anything added here later:
 *   · Expose named operations, never a general channel. No `invoke(channel, ...)`
 *     passthrough. That is an open door with a narrow-looking frame.
 *   · Never expose `fs`, `child_process`, `shell`, or a path the renderer picks.
 *   · The log is READ-ONLY from this surface. There is no append here, and the
 *     viewer never writes to the event log (02-CORE §3.5). One operation changes
 *     something, `queue.answer`, and it changes it by asking the control plane
 *     to record a person's decision rather than by writing anything itself.
 */

import { contextBridge, ipcRenderer } from "electron";

/** Mirrors main/control-plane.ts. Kept here so the renderer has no import into main. */
interface Unreachable {
	readonly ok: false;
	readonly problem: string;
}
type Result<T> = { readonly ok: true; readonly value: T } | Unreachable;

export interface WireEvent {
	readonly id: string;
	readonly recordedAt: string;
	readonly actor: string;
	readonly objective: string | null;
	readonly type: string;
	readonly epoch: string;
	readonly payload: Record<string, unknown>;
}

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
	readonly contractHash: string | null;
	readonly refusedBecause?: string | null;
	readonly contract: {
		readonly criteria: readonly WireCriterion[];
		readonly nonGoals: readonly string[];
		readonly failureConditions: readonly string[];
	};
}

export interface WireSuspension {
	readonly worker: string;
	readonly objective: string | null;
	readonly kind: string;
	readonly reason: string;
	readonly resumeAt: string | null;
	readonly question: string | null;
	readonly since: string;
}

export interface WireApproval {
	readonly capabilityId: string;
	readonly holder: string;
	readonly operation: string;
	readonly target: string;
	readonly approval: string;
	readonly resource: string;
	readonly scope: string;
	readonly operations: readonly string[];
	readonly askedAt: string;
}

export interface WireVerdict {
	readonly criterionId: string;
	readonly result: string;
	readonly evidence: readonly string[];
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

export interface WireCost {
	readonly resource: string;
	readonly settled: number;
	readonly calls: number;
}

export interface LogQuery {
	readonly objective?: string;
	readonly actor?: string;
	readonly limit?: number;
}

const api = {
	version: process.versions.electron,

	/** Read the log. There is no write counterpart and there will not be one. */
	log: {
		/**
		 * Be told when the log gains something.
		 *
		 * A callback, not a channel: the renderer cannot listen to anything except
		 * the two things named here, and cannot send on either.
		 */
		onRecorded: (listener: () => void): (() => void) => {
			const handler = () => listener();
			ipcRenderer.on("log:recorded", handler);
			return () => ipcRenderer.off("log:recorded", handler);
		},
		onTrouble: (listener: (problem: string) => void): (() => void) => {
			const handler = (_event: unknown, problem: string) => listener(problem);
			ipcRenderer.on("log:trouble", handler);
			return () => ipcRenderer.off("log:trouble", handler);
		},
		events: (query: LogQuery = {}): Promise<Result<WireEvent[]>> =>
			ipcRenderer.invoke("log:events", query),
		health: (): Promise<Result<{ ok: boolean }>> => ipcRenderer.invoke("log:health"),
	},

	/**
	 * What is waiting on a person, and answering it.
	 *
	 * `answer` is the only thing on this bridge that changes anything. It does not
	 * write to the log: it asks the control plane to record that a person decided
	 * something, under that person's name.
	 */
	queue: {
		list: (): Promise<Result<WireSuspension[]>> => ipcRenderer.invoke("queue:list"),
		answer: (input: {
			worker: string;
			objective: string | null;
			because: string;
			answeredBy: string;
		}): Promise<Result<{ resumed: boolean }>> => ipcRenderer.invoke("queue:answer", input),

		approvals: (): Promise<Result<WireApproval[]>> => ipcRenderer.invoke("queue:approvals"),

		/** Allow it or refuse it. A refusal is recorded, not merely withheld. */
		decide: (input: {
			capabilityId: string;
			granted: boolean;
			reason: string;
			approver: string;
		}): Promise<Result<{ granted: boolean }>> => ipcRenderer.invoke("queue:decide", input),
	},

	/**
	 * Stop everything, from anywhere.
	 *
	 * `01-PRINCIPLES` P13 does not yield. It is on the bridge rather than behind a
	 * menu because a stop nobody can find is a stop nobody has.
	 */
	stop: {
		everything: (input: {
			reason: string;
			actor: string;
		}): Promise<Result<{ stopped: boolean; revoked: string[] }>> =>
			ipcRenderer.invoke("stop:everything", input),
	},

	/** Objectives, folded from the log. Read only, like everything on this bridge. */
	objectives: {
		list: (): Promise<Result<WireObjective[]>> => ipcRenderer.invoke("objectives:list"),
		one: (id: string): Promise<Result<WireObjective>> =>
			ipcRenderer.invoke("objectives:one", id),
		evaluations: (id: string): Promise<Result<WireEvaluation[]>> =>
			ipcRenderer.invoke("objectives:evaluations", id),
		cost: (id: string): Promise<Result<WireCost[]>> =>
			ipcRenderer.invoke("objectives:cost", id),

		/** State one. Refusal comes back as problems, because refusal is an answer. */
		state: (input: {
			statement: string;
			contract: unknown;
			origin: string;
		}): Promise<Result<{ objective: WireObjective; problems: string[] }>> =>
			ipcRenderer.invoke("objectives:state", input),

		/** Ask the model what the contract should say. Nothing is admitted by this. */
		draft: (input: {
			statement: string;
			capabilityId: string;
		}): Promise<Result<{ text: string; cost: number }>> =>
			ipcRenderer.invoke("objectives:draft", input),

		drafters: (): Promise<Result<{ id: string; holder: string }[]>> =>
			ipcRenderer.invoke("objectives:drafters"),
	},
} as const;

export type MaschinaApi = typeof api;

contextBridge.exposeInMainWorld("maschina", api);
