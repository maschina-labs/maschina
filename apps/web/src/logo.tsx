import { useState } from "react";

/**
 * The mark is an Allen screw. Each time the cursor arrives it turns one full turn forward, the way a key
 * drives a screw, and it stays where it stopped: leaving never winds it back. Still for anyone who asks
 * their system for less motion.
 */
function Mark({ large }: { large: boolean }) {
	const [turns, setTurns] = useState(0);
	const still =
		typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	return (
		<img
			data-mark
			src="/brand/favicon.svg"
			alt=""
			onPointerEnter={() => !still && setTurns((count) => count + 1)}
			style={{ transform: `rotate(${turns * 360}deg)` }}
			className={`shrink-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${large ? "size-5 sm:size-6" : "size-4 sm:size-5"}`}
		/>
	);
}

/** The mark and the word, linking home. The header's is larger (`large`) so it holds its own on a phone; the footer's is the plain size. */
export function Logo({ large = false }: { large?: boolean }) {
	return (
		<a href="/" aria-label="Maschina, home" className="flex w-fit items-center">
			<Mark large={large} />
			<span data-word className="ml-1.5">
				<img
					src="/brand/word.svg"
					alt=""
					className={`w-auto ${large ? "h-5 sm:h-6" : "h-4 sm:h-5"}`}
				/>
			</span>
		</a>
	);
}
