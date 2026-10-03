/**
 * The window the city is seen through: clear, or pebbled like bathroom glass. A look, kept per browser
 * and off unless chosen, so it is one press to try and one press to undo.
 */

import { useSyncExternalStore } from "react";
import { preview } from "./preview.ts";

export type Glass = "clear" | "pebbled";

const KEY = "maschina.glass";
const CHANGED = "maschina:glass";

function read(): Glass {
	// ?glass=pebbled while developing, to look without changing the saved choice.
	if (preview("glass") === "pebbled") return "pebbled";
	try {
		return localStorage.getItem(KEY) === "pebbled" ? "pebbled" : "clear";
	} catch {
		return "clear";
	}
}

export function setGlass(glass: Glass) {
	try {
		if (glass === "clear") localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, glass);
	} catch {}
	window.dispatchEvent(new Event(CHANGED));
}

export function useGlass(): Glass {
	return useSyncExternalStore(
		(changed) => {
			window.addEventListener(CHANGED, changed);
			return () => window.removeEventListener(CHANGED, changed);
		},
		read,
		() => "clear",
	);
}
