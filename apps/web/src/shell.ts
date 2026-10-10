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

/** How much room the header takes at the top of the screen, for something too tall to be centered. */
const HEADER_ROOM = 96;

/**
 * Scrolls so that something sits in the middle of the screen, working out where once and going straight there, with
 * no drift and no stop at the top of it like the browser's own jump to an address. A thing too tall for the screen
 * cannot be centered, so its top goes just under the header instead. It scrolls whatever scrolls the page (the window,
 * or the root box on a touch screen), and glides unless the reader asked for less motion.
 */
export function centerInView(element: HTMLElement): void {
	const target = scroller();
	const room = target === window ? window.innerHeight : (target as HTMLElement).clientHeight;
	const box = element.getBoundingClientRect();
	const place = scrolled(target) + box.top;
	const top =
		box.height + HEADER_ROOM > room ? place - HEADER_ROOM : place - (room - box.height) / 2;
	const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
	target.scrollTo({ top, behavior: calm ? "auto" : "smooth" });
}
