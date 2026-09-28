import { type RefObject, useEffect, useState } from "react";

/**
 * A ruler down both edges of the screen that follows the page as it scrolls: the tick at your place
 * stretches long and bright, and its neighbours taper off. Brought back from the first Maschina web app,
 * in white rather than its red. Decoration only: it never takes a click and screen readers skip it.
 */

const TICKS = 48;

/** Which tick the scroll position lands on, 0 at the top and TICKS - 1 at the bottom. */
export function tickFor(scrollTop: number, scrollHeight: number, clientHeight: number): number {
	const room = scrollHeight - clientHeight;
	if (room <= 0) return 0;
	return Math.round(Math.min(1, Math.max(0, scrollTop / room)) * (TICKS - 1));
}

function Ruler({ at, side }: { at: number; side: "left" | "right" }) {
	return (
		<div
			aria-hidden="true"
			className={`pointer-events-none fixed top-14 bottom-9 z-30 flex w-6 flex-col justify-between ${
				side === "left" ? "left-0 items-start" : "right-0 items-end"
			}`}
		>
			{Array.from({ length: TICKS }, (_, index) => {
				const distance = Math.abs(index - at);
				const width = distance === 0 ? 22 : distance <= 2 ? 14 - distance * 3 : 6;
				const alpha = distance === 0 ? 0.9 : distance <= 2 ? 0.4 - distance * 0.1 : 0.12;
				return (
					<span
						// The ticks never reorder, so their place is their identity.
						// biome-ignore lint/suspicious/noArrayIndexKey: see above
						key={index}
						className="block h-px transition-[width,background-color] duration-150"
						style={{ width, backgroundColor: `oklch(1 0 0 / ${alpha})` }}
					/>
				);
			})}
		</div>
	);
}

/** Follows whichever element scrolls the page. */
export function ScrollTicks({ target }: { target: RefObject<HTMLElement | null> }) {
	const [at, setAt] = useState(0);
	useEffect(() => {
		const page = target.current;
		if (!page) return;
		let frame = 0;
		const follow = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() =>
				setAt(tickFor(page.scrollTop, page.scrollHeight, page.clientHeight)),
			);
		};
		page.addEventListener("scroll", follow, { passive: true });
		return () => {
			page.removeEventListener("scroll", follow);
			cancelAnimationFrame(frame);
		};
	}, [target]);
	return (
		<>
			<Ruler at={at} side="left" />
			<Ruler at={at} side="right" />
		</>
	);
}
