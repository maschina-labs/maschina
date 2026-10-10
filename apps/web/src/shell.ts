/**
 * The shell: on a touch screen the page does not scroll as a document. The document is held still, as tall as the
 * screen, and one box inside it (the root) does the scrolling. A phone's address bar and toolbar slide away only
 * when the document scrolls, and it is their sliding that resizes and shifts a page, so when nothing but a box
 * scrolls they never move, and the page is never stretched, pushed up or let back down. A mouse or a trackpad keeps
 * the ordinary page, so a desktop is exactly as it was.
 */
const SHELL = "(hover: none) and (pointer: coarse)";

export function inShell(): boolean {
	return typeof window !== "undefined" && (window.matchMedia?.(SHELL)?.matches ?? false);
}

/** What scrolls the page: the root box in the shell, the window otherwise. */
export function scroller(): HTMLElement | Window {
	if (inShell()) {
		const root = document.getElementById("root");
		if (root) return root;
	}
	return window;
}

/** How far down the page has scrolled. */
export const scrolled = (target: HTMLElement | Window): number =>
	"scrollY" in target ? target.scrollY : target.scrollTop;
