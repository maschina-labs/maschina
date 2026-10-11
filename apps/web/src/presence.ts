import { useEffect, useState } from "react";

/** How long after mounting before something turns visible, so its entrance has a first frame to start from. */
const ENTER_MS = 20;

/**
 * Keeps something on screen while it plays its exit, so it can slide away instead of blinking out.
 *
 * - `mounted`: render it at all. True from the moment it opens until its exit has finished.
 * - `visible`: show it in its open state. False for a moment on arrival, so a transition has somewhere to
 *   start, and false the instant it starts to leave.
 * - `closing`: it has been asked to go but is still on screen, so it should be hidden from assistive
 *   technology and not take focus.
 *
 * With `exitMs` of 0 (as with reduced motion) it is removed at once.
 */
export function usePresence(show: boolean, exitMs: number) {
	const [mounted, setMounted] = useState(show);
	const [visible, setVisible] = useState(show);

	useEffect(() => {
		if (show) {
			setMounted(true);
			const arrive = setTimeout(() => setVisible(true), ENTER_MS);
			return () => clearTimeout(arrive);
		}
		setVisible(false);
		if (exitMs === 0) {
			setMounted(false);
			return;
		}
		const leave = setTimeout(() => setMounted(false), exitMs);
		return () => clearTimeout(leave);
	}, [show, exitMs]);

	// Mounted from the very first render of opening, not a render later, so whatever is inside can be focused
	// as soon as it opens. With no exit to play it is gone in the same render it is closed.
	return {
		mounted: show || (mounted && exitMs > 0),
		visible: show && visible,
		closing: !show && mounted && exitMs > 0,
	};
}
