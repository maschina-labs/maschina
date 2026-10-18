/**
 * When the detail layer is allowed to show what is on it.
 *
 * The layer opens in steps: a plain card grows out of the tile, and the content fades in once it has
 * landed. Two clocks drive that, and they are not the same clock. The growing starts on an animation
 * frame, and the landing on a timer started at mount.
 *
 * A tab that is not being looked at gets **no animation frames at all**, while its timers still run.
 * So the frame can arrive after the landing, and if it does, it would put a screen that had already
 * opened back to growing, where nothing is visible and nothing ever moves it on again. Opening a link
 * in a background tab is an ordinary thing to do, so this was an ordinary black screen.
 *
 * Hence a reducer rather than three `setPhase` calls: the steps only go forwards, and the landing
 * works whether or not the frames ever came. The animation is something you get when the browser can
 * afford it, never a thing the page waits on to become visible.
 */

export type RevealPhase = "tile" | "growing" | "open" | "fading";

/** `frame`: the browser drew. `landed`: the growing is over. `close`: leaving. */
export type RevealEvent = "frame" | "landed" | "close";

export function nextPhase(at: RevealPhase, event: RevealEvent): RevealPhase {
	if (event === "close") return at === "fading" ? at : "fading";
	// A screen on its way out is never pulled back open by a late frame or a stale timer.
	if (at === "fading") return at;
	if (event === "landed") return "open";
	return at === "tile" ? "growing" : at;
}
