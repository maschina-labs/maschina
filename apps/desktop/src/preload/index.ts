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
 *     viewer never writes to the event log (02-CORE §3.5).
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

export interface LogQuery {
	readonly objective?: string;
	readonly actor?: string;
	readonly limit?: number;
}

const api = {
	version: process.versions.electron,

	/** Read the log. There is no write counterpart and there will not be one. */
	log: {
		events: (query: LogQuery = {}): Promise<Result<WireEvent[]>> =>
			ipcRenderer.invoke("log:events", query),
		health: (): Promise<Result<{ ok: boolean }>> => ipcRenderer.invoke("log:health"),
	},
} as const;

export type MaschinaApi = typeof api;

contextBridge.exposeInMainWorld("maschina", api);
