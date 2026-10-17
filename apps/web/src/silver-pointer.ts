/** What a silver button is: the shared class on the real buttons. */
const SILVER = ".silver-button";

/**
 * Makes the pearl shimmer on a silver button follow the pointer. It is one listener on the whole page: when the pointer
 * moves over a silver button, the button learns where the pointer is across its width, as `--shine-x`, and the stylesheet
 * slides the shimmer to there. Moving the pointer never re-renders anything. A finger has no hover, and anyone who asked for
 * less motion gets a still button, so both are ignored. Returns a function that switches it off.
 */
export function followSilver(): () => void {
	const move = (event: Event) => {
		const pointer = event as PointerEvent;
		if (pointer.pointerType === "touch") return;
		if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
		const button = (event.target as Element | null)?.closest?.<HTMLElement>(SILVER);
		if (!button) return;
		const box = button.getBoundingClientRect();
		if (box.width === 0) return;
		const across = Math.min(1, Math.max(0, (pointer.clientX - box.left) / box.width));
		button.style.setProperty("--shine-x", `${across * 100}%`);
	};
	// Letting go when the pointer leaves, so the next visit starts from the far end again.
	const leave = (event: Event) => {
		const button = (event.target as Element | null)?.closest?.<HTMLElement>(SILVER);
		if (!button) return;
		const into = (event as PointerEvent).relatedTarget as Node | null;
		if (into && button.contains(into)) return;
		button.style.removeProperty("--shine-x");
	};
	document.addEventListener("pointermove", move, { passive: true });
	document.addEventListener("pointerout", leave, { passive: true });
	return () => {
		document.removeEventListener("pointermove", move);
		document.removeEventListener("pointerout", leave);
	};
}
