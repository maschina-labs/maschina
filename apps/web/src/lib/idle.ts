import { useEffect, useState } from "react";

/**
 * Idle mode: left alone, the dashboard drifts through the sections by itself, slowly, round and round,
 * for a screen left on a nightstand or a second monitor. It starts on its own after a minute without a
 * touch, unless that is switched off, and it can be started at once from the tiles.
 */

const KEY = "maschina.idle";
const CHANGED = "maschina:idle";
const NOW = "maschina:idle-now";

/** How long without a touch, a key or the mouse before it starts drifting by itself. */
export const IDLE_MS = 60_000;

/** On unless switched off. Remembered in this browser only. */
function read(): boolean {
	try {
		return localStorage.getItem(KEY) !== "off";
	} catch {
		return true;
	}
}

/** Whether it starts by itself after a minute. */
export function setIdleMode(on: boolean) {
	try {
		if (on) localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, "off");
	} catch {}
	window.dispatchEvent(new Event(CHANGED));
}

export function useIdleMode(): boolean {
	const [on, setOn] = useState(read);
	useEffect(() => {
		const update = () => setOn(read());
		window.addEventListener(CHANGED, update);
		return () => window.removeEventListener(CHANGED, update);
	}, []);
	return on;
}

/** Starts drifting now, whatever the setting. */
export function playIdleNow() {
	window.dispatchEvent(new Event(NOW));
}

/** Listens for "start now". */
export function onIdleNow(start: () => void): () => void {
	window.addEventListener(NOW, start);
	return () => window.removeEventListener(NOW, start);
}
