import { useEffect, useState } from "react";
import { preview } from "../lib/preview.ts";

/**
 * The opening moment: the whole logo, ring and name, alone on the fog, then the tiles arriving as it
 * fades. Inside the app the name is quiet, so this is where it is seen in full. Once per visit, so moving
 * around the app never replays it. With reduced motion it is only a short fade.
 */

const KEY = "maschina.splashed";
/** One second for the logo to arrive, one second held, one second fading out as the app fades in. */
export const IN_MS = 1000;
export const HOLD_MS = 1000;
export const FADE_MS = 1000;

export type SplashPhase = "mark" | "leaving" | "done";

function seenThisVisit(): boolean {
	// ?splash plays it again while developing, to look at it without opening a new tab.
	if (preview("splash") !== undefined) return false;
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
		const leave = setTimeout(() => setPhase("leaving"), still ? 0 : IN_MS + HOLD_MS);
		const done = setTimeout(
			() => {
				setPhase("done");
				try {
					sessionStorage.setItem(KEY, "1");
				} catch {}
			},
			(still ? 0 : IN_MS + HOLD_MS) + FADE_MS,
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
				src="/brand/word.svg"
				alt=""
				className="brand-mark h-auto w-[min(64vw,340px)] md:w-[420px]"
				style={{ animation: `splash ${IN_MS}ms ease-out both` }}
			/>
		</div>
	);
}
