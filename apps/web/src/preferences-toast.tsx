import { useEffect, useState } from "react";
import {
	OPEN_PREFERENCES,
	type Preference,
	readPreference,
	savePreference,
} from "./preferences.ts";

/**
 * The cookie preferences, as a small toast at the bottom center of the screen that asks to accept or decline and saves
 * the answer. It is not a page and not a banner that greets a first visit: it opens only when the footer's Preferences
 * link is pressed, and it closes on either answer or on Escape (which saves nothing). It shows the choice already made,
 * if there is one. Square, with the site's two buttons, the gray one to decline and the pearl one to accept.
 */
export function PreferencesToast() {
	const [open, setOpen] = useState(false);
	const [choice, setChoice] = useState<Preference | null>(null);

	useEffect(() => {
		const show = () => {
			setChoice(readPreference());
			setOpen(true);
		};
		window.addEventListener(OPEN_PREFERENCES, show);
		return () => window.removeEventListener(OPEN_PREFERENCES, show);
	}, []);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	if (!open) return null;
	const answer = (value: Preference) => {
		savePreference(value);
		setOpen(false);
	};

	return (
		<div
			role="dialog"
			aria-label="Cookie preferences"
			className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 bg-[oklch(0.2_0.008_285)] p-5 text-left shadow-[0_20px_60px_-20px_oklch(0_0_0/0.8)]"
		>
			<p className="text-[15px] text-white">Cookie preferences</p>
			<p className="mt-2 text-[14px] text-neutral-400 leading-snug">
				Essential cookies keep you signed in and always stay on. Choose whether Maschina may use
				optional cookies, which are for measuring how the site is used.
			</p>
			{choice ? <p className="mt-3 text-[13px] text-neutral-500">Your choice: {choice}</p> : null}
			<div className="mt-5 grid grid-cols-2 gap-2 text-[15px]">
				<button
					type="button"
					onClick={() => answer("declined")}
					className="inline-flex h-10 items-center justify-center bg-white/[0.13] px-5 text-neutral-200 transition-colors hover:bg-white/[0.18] max-sm:font-medium max-sm:text-white"
				>
					Decline
				</button>
				<button
					type="button"
					onClick={() => answer("accepted")}
					className="inline-flex h-10 items-center justify-center bg-[oklch(0.93_0.02_300)] px-5 text-black transition-colors hover:bg-[oklch(0.98_0.015_300)] max-sm:font-medium"
				>
					Accept
				</button>
			</div>
		</div>
	);
}
