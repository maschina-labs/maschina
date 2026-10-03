import { useEffect, useState } from "react";

/**
 * The opening moment: the ring alone on the fog, then the tiles arriving as it fades. Once per visit, so
 * moving around the app never replays it. With reduced motion it is only a short fade.
 */

const KEY = "maschina.splashed";
/** How long the ring holds before it starts to go, and how long the hand-over takes. */
export const HOLD_MS = 700;
export const FADE_MS = 500;

export type SplashPhase = "mark" | "leaving" | "done";

function seenThisVisit(): boolean {
	try {
		return sessionStorage.getItem(KEY) === "1";
	} catch {
		return false;
	}
}

export function useSplash(): SplashPhase {
	const [phase, setPhase] = useState<SplashPhase>(() => (seenThisVisit() ? "done" : "mark"));
	// Started once, when the app opens: re-running it on each phase would restart the clock.
	useEffect(() => {
		if (seenThisVisit()) return;
		const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
		const leave = setTimeout(() => setPhase("leaving"), still ? 0 : HOLD_MS);
		const done = setTimeout(
			() => {
				setPhase("done");
				try {
					sessionStorage.setItem(KEY, "1");
				} catch {}
			},
			(still ? 0 : HOLD_MS) + FADE_MS,
		);
		return () => {
			clearTimeout(leave);
			clearTimeout(done);
		};
	}, []);
	return phase;
}

export function Splash({ phase }: { phase: SplashPhase }) {
	if (phase === "done") return null;
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0 z-[95] grid place-items-center transition-opacity ease-out"
			style={{ opacity: phase === "mark" ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
		>
			<img
				src="/favicon.svg"
				alt=""
				className="size-16 animate-[splash_700ms_ease-out_both] md:size-20"
			/>
		</div>
	);
}
