/** How long after the last scroll event the scrollbar stays on screen. */
const QUIET_MS = 900;

/**
 * Marks whatever is scrolling with `data-scrolling`, and takes the mark off a moment after it stops. The
 * square scrollbars are drawn with webkit rules, which unlike the system's own are always visible; the
 * styles show the track and thumb only under this mark, so they appear while scrolling and fade from sight
 * after, the way a scrollbar normally behaves. Scroll events do not bubble, so this listens while they
 * travel down. Returns what stops it.
 */
export function showScrollbarsWhileScrolling(doc: Document): () => void {
	const timers = new Map<Element, ReturnType<typeof setTimeout>>();
	const onScroll = (event: Event) => {
		const target = event.target;
		// The page's own scrollbar takes its style from the body, not the root element.
		const element = target === doc ? doc.body : target instanceof Element ? target : null;
		if (!element) return;
		element.setAttribute("data-scrolling", "");
		clearTimeout(timers.get(element));
		timers.set(
			element,
			setTimeout(() => {
				element.removeAttribute("data-scrolling");
				timers.delete(element);
			}, QUIET_MS),
		);
	};
	doc.addEventListener("scroll", onScroll, true);
	return () => {
		doc.removeEventListener("scroll", onScroll, true);
		for (const timer of timers.values()) clearTimeout(timer);
		timers.clear();
	};
}
