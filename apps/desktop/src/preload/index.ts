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

export interface WireDay {
	readonly date: string;
	readonly events: number;
}

export interface WireStats {
	readonly events: number;
	readonly objectivesStated: number;
	readonly objectivesAccomplished: number;
	readonly criteriaSatisfied: number;
	readonly effects: number;
	readonly denials: number;
	readonly approvalsGiven: number;
	readonly questionsAsked: number;
	readonly questionsAnswered: number;
	readonly nullSteps: number;
	readonly spent: number;
	readonly days: readonly WireDay[];
	readonly streak: number;
}

export interface Entry {
	readonly name: string;
	readonly path: string;
	readonly directory: boolean;
}

interface Done<T> {
	readonly ok: boolean;
	readonly value?: T;
	readonly problem?: string;
}

export interface Change {
	readonly code: string;
	readonly path: string;
	readonly staged: boolean;
}

export interface Status {
	readonly branch: string;
	readonly upstream: string | null;
	readonly ahead: number;
	readonly behind: number;
	readonly changes: readonly Change[];
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
	 * The operator's own files.
	 *
	 * Not a worker's. `ADR-003` §3.2: a human surface having access to a path
	 * never confers that access on a worker, and the two share no module. A
	 * worker's file access is a capability; this is a person opening their own
	 * files.
	 */
	workspace: {
		open: (): Promise<Done<{ root: string; name: string }>> =>
			ipcRenderer.invoke("workspace:open"),
		opened: (): Promise<string | null> => ipcRenderer.invoke("workspace:opened"),
		list: (within: string): Promise<Done<Entry[]>> =>
			ipcRenderer.invoke("workspace:list", within),
		read: (path: string): Promise<Done<{ text: string; path: string }>> =>
			ipcRenderer.invoke("workspace:read", path),
		write: (input: { path: string; text: string }): Promise<Done<{ path: string }>> =>
			ipcRenderer.invoke("workspace:write", input),
	},

	/**
	 * The operator's git, on the directory they opened.
	 *
	 * Not the repository capability. A worker commits through a broker so it
	 * never sees a credential, and every commit is an Intent and an Outcome. This
	 * is a person running git on their own repository, and the history it makes
	 * is indistinguishable from history made in any terminal.
	 *
	 * There is no force-push here and there is no argument that could produce
	 * one.
	 */
	git: {
		status: (): Promise<Done<Status>> => ipcRenderer.invoke("git:status"),
		diff: (path?: string): Promise<Done<string>> => ipcRenderer.invoke("git:diff", path),
		branches: (): Promise<Done<string[]>> => ipcRenderer.invoke("git:branches"),
		stage: (paths: readonly string[]): Promise<Done<null>> =>
			ipcRenderer.invoke("git:stage", paths),
		unstage: (paths: readonly string[]): Promise<Done<null>> =>
			ipcRenderer.invoke("git:unstage", paths),
		commit: (message: string): Promise<Done<string>> =>
			ipcRenderer.invoke("git:commit", message),
		push: (): Promise<Done<string>> => ipcRenderer.invoke("git:push"),
	},

	/**
	 * The operator's own shell.
	 *
	 * Not a worker's, and never will be. `ADR-003` §3.1: they are different
	 * mechanisms that do not share a code path, because a pseudoterminal on
	 * somebody's real shell has no isolation boundary and holds their whole
	 * machine. A worker's shell lives inside an isolation boundary on a node.
	 */
	terminal: {
		start: (input: { id: string; cwd: string | null }): void =>
			ipcRenderer.send("terminal:start", input),
		write: (input: { id: string; data: string }): void =>
			ipcRenderer.send("terminal:write", input),
		resize: (input: { id: string; cols: number; rows: number }): void =>
			ipcRenderer.send("terminal:resize", input),
		stop: (id: string): void => ipcRenderer.send("terminal:stop", id),

		onData: (id: string, listener: (chunk: string) => void): (() => void) => {
			const handler = (_event: unknown, chunk: string) => listener(chunk);
			ipcRenderer.on(`terminal:data:${id}`, handler);
			return () => ipcRenderer.off(`terminal:data:${id}`, handler);
		},
		onExit: (id: string, listener: (code: number) => void): (() => void) => {
			const handler = (_event: unknown, code: number) => listener(code);
			ipcRenderer.on(`terminal:exit:${id}`, handler);
			return () => ipcRenderer.off(`terminal:exit:${id}`, handler);
		},
		onProblem: (id: string, listener: (problem: string) => void): (() => void) => {
			const handler = (_event: unknown, problem: string) => listener(problem);
			ipcRenderer.on(`terminal:problem:${id}`, handler);
			return () => ipcRenderer.off(`terminal:problem:${id}`, handler);
		},
	},

	/** What has been done, counted. Never shown to a worker. */
	stats: {
		read: (): Promise<Result<WireStats>> => ipcRenderer.invoke("stats:read"),
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
