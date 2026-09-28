import { ArrowsIn, ArrowsOut } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Anything that can fill the screen: a button at its top right, and Escape (the browser's own) to come
 * back. Used for the chart, so the band and the candles can be watched with nothing else on screen.
 */
export function Fullscreen({ children, label }: { children: ReactNode; label: string }) {
	const box = useRef<HTMLDivElement>(null);
	const [full, setFull] = useState(false);
	useEffect(() => {
		const follow = () => setFull(document.fullscreenElement === box.current);
		document.addEventListener("fullscreenchange", follow);
		return () => document.removeEventListener("fullscreenchange", follow);
	}, []);
	const toggle = () => {
		if (document.fullscreenElement) void document.exitFullscreen();
		else void box.current?.requestFullscreen?.();
	};
	return (
		<div ref={box} className="relative h-full w-full fullscreen:bg-black fullscreen:p-6">
			{children}
			<button
				type="button"
				onClick={toggle}
				aria-label={full ? `Leave full screen` : `${label} full screen`}
				title={full ? "Leave full screen" : "Full screen"}
				className="absolute top-1 right-16 z-10 grid size-7 place-items-center text-neutral-500 transition-colors hover:text-neutral-100"
			>
				{full ? <ArrowsIn size={14} weight="light" /> : <ArrowsOut size={14} weight="light" />}
			</button>
		</div>
	);
}
