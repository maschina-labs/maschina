import { useEffect, useState } from "react";
import type { Side } from "./portfolio.ts";

/**
 * Which money the app shows: live, by default, or paper. One at a time, everywhere, and never the two in
 * one number (D-096). Remembered in this browser only.
 */

const KEY = "maschina.side";
const CHANGED = "maschina:side";

function read(): Side {
	try {
		return localStorage.getItem(KEY) === "paper" ? "paper" : "live";
	} catch {
		return "live";
	}
}

export function setSide(side: Side) {
	try {
		localStorage.setItem(KEY, side);
	} catch {}
	window.dispatchEvent(new Event(CHANGED));
}

export function useSide(): Side {
	const [side, setShown] = useState(read);
	useEffect(() => {
		const changed = () => setShown(read());
		window.addEventListener(CHANGED, changed);
		return () => window.removeEventListener(CHANGED, changed);
	}, []);
	return side;
}
