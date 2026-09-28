import { useEffect, useState } from "react";

/**
 * Text that resolves into place: every letter starts as noise and locks, left to right, into the real one.
 * Brought over from the first Maschina web app. The real text is always what screen readers get.
 */

const NOISE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const noise = () => NOISE[Math.floor(Math.random() * NOISE.length)] ?? "X";

/** The text with the first `locked` letters settled and the rest as noise; spaces always stay spaces. */
export function scrambled(text: string, locked: number, pick: () => string = noise): string {
	return [...text]
		.map((letter, index) => (letter === " " || index < locked ? letter : pick()))
		.join("");
}

export function Scramble({
	text,
	className,
	perLetterMs = 45,
}: {
	text: string;
	className?: string;
	perLetterMs?: number;
}) {
	const [shown, setShown] = useState(() => scrambled(text, 0));
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setShown(text);
			return;
		}
		let frame = 0;
		const start = performance.now();
		const tick = (now: number) => {
			const locked = Math.floor((now - start) / perLetterMs);
			setShown(scrambled(text, locked));
			if (locked < text.length) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [text, perLetterMs]);
	return (
		<span className={className}>
			<span className="sr-only">{text}</span>
			<span aria-hidden="true">{shown}</span>
		</span>
	);
}
