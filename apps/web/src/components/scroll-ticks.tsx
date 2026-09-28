import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * A scrolling area whose scrollbar is a ruler: thin ticks down its right edge, the one at your place long
 * and bright, its neighbours tapering off. Brought back from the first Maschina web app, in white. It only
 * shows when there is something to scroll, and it never takes a click or reaches a screen reader.
 */

/** Room between ticks, so a tall area gets more of them and a short one fewer. */
const SPACING = 14;

/** Where the scroll position sits, 0 at the top and 1 at the bottom, or undefined when nothing scrolls. */
export function placeOf(
	scrollTop: number,
	scrollHeight: number,
	clientHeight: number,
): number | undefined {
	const room = scrollHeight - clientHeight;
	if (room <= 1) return undefined;
	return Math.min(1, Math.max(0, scrollTop / room));
}

function Ruler({ place, height }: { place: number; height: number }) {
	const count = Math.max(8, Math.floor(height / SPACING));
	const at = Math.round(place * (count - 1));
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute top-0 right-0 bottom-0 flex w-3 flex-col items-end justify-between py-1"
		>
			{Array.from({ length: count }, (_, index) => {
				const distance = Math.abs(index - at);
				const width = distance === 0 ? 12 : distance <= 2 ? 9 - distance * 2 : 4;
				const alpha = distance === 0 ? 0.85 : distance <= 2 ? 0.4 - distance * 0.1 : 0.12;
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

export function ScrollArea({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	const area = useRef<HTMLDivElement>(null);
	const [place, setPlace] = useState<number>();
	const [height, setHeight] = useState(0);
	useEffect(() => {
		const element = area.current;
		if (!element) return;
		let frame = 0;
		const measure = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				setPlace(placeOf(element.scrollTop, element.scrollHeight, element.clientHeight));
				setHeight(element.clientHeight);
			});
		};
		measure();
		element.addEventListener("scroll", measure, { passive: true });
		// Content arrives after the first paint, so size changes are watched as well as scrolling.
		const watcher = new ResizeObserver(measure);
		watcher.observe(element);
		for (const child of Array.from(element.children)) watcher.observe(child);
		return () => {
			element.removeEventListener("scroll", measure);
			watcher.disconnect();
			cancelAnimationFrame(frame);
		};
	}, []);
	return (
		<div className="relative h-full min-h-0">
			<div
				ref={area}
				className={`no-scrollbar h-full overflow-y-auto overscroll-none ${className}`}
			>
				{children}
			</div>
			{place === undefined ? null : <Ruler place={place} height={height} />}
		</div>
	);
}
