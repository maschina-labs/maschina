import { useEffect, useState } from "react";

/**
 * A number that rolls when it changes, like an odometer: each digit is a column of 0 to 9 that slides to
 * its new place, while signs, commas, points and units stay where they are. The first showing rolls up
 * from zero, once. With reduced motion asked for, it simply changes.
 *
 * The real text is there for screen readers and copying; the rolling columns are only what is seen.
 */

const DIGITS = "0123456789";

function still(): boolean {
	return (
		typeof window !== "undefined" &&
		(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
	);
}

export function Odometer({ value }: { value: string }) {
	// Rolls in from zeros the first time it is drawn.
	const [shown, setShown] = useState(() => (still() ? value : value.replace(/\d/g, "0")));
	useEffect(() => {
		const frame = requestAnimationFrame(() => setShown(value));
		return () => cancelAnimationFrame(frame);
	}, [value]);
	const characters = [...shown];
	return (
		<span className="relative inline-flex tabular-nums">
			<span className="sr-only">{value}</span>
			<span aria-hidden="true" className="inline-flex">
				{characters.map((character, index) => {
					// Placed from the right, so a number growing a digit rolls in at the front, not shuffling all.
					const key = characters.length - index;
					if (!DIGITS.includes(character))
						return (
							<span key={`c${key}`} className="inline-block">
								{character}
							</span>
						);
					return (
						<span
							key={`d${key}`}
							className="relative inline-block h-[1em] overflow-hidden leading-none"
						>
							<span
								className="flex flex-col transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
								style={{ transform: `translateY(-${Number(character)}em)` }}
							>
								{[...DIGITS].map((digit) => (
									<span key={digit} className="block h-[1em] leading-none">
										{digit}
									</span>
								))}
							</span>
						</span>
					);
				})}
			</span>
		</span>
	);
}
