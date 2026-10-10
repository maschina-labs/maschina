import { useEffect, useRef } from "react";
import { inShell } from "./shell.ts";

/** How far the page follows a finger: half of it, up to a limit, so it feels like it is being stretched. */
const RESISTANCE = 0.5;
const LIMIT = 96;
/** How far down it has to be pulled, once the resistance is counted, for letting go to refresh. */
const ENOUGH = 56;
const EASE = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Pull down to refresh, drawn by the page itself. In the shell the document does not scroll, so the browser has no
 * pull to refresh of its own to offer; this is one. When the page is at the top and a finger drags down, the whole page
 * (the header with it) follows the finger a little way and a loader shows above it; let go far enough and it reloads,
 * let go early and the page slides back. It wraps the whole page and only listens on a touch screen, so a mouse and a
 * trackpad do not meet it.
 */
export function PullToRefresh({
	children,
	className,
	refresh = () => window.location.reload(),
}: {
	children: React.ReactNode;
	className?: string;
	refresh?: () => void;
}) {
	const page = useRef<HTMLDivElement>(null);
	const loader = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!inShell()) return;
		const target = document.getElementById("root");
		const content = page.current;
		const light = loader.current;
		if (!target || !content || !light) return;
		const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
		let start: number | null = null;
		let pulled = 0;
		let busy = false;

		const draw = (px: number, easing: boolean) => {
			content.style.transition = easing && !calm ? EASE : "none";
			content.style.transform = px ? `translateY(${px}px)` : "";
			light.style.opacity = String(Math.min(1, px / ENOUGH));
		};

		const onStart = (event: TouchEvent) => {
			if (busy) return;
			start = target.scrollTop <= 0 ? (event.touches[0]?.clientY ?? null) : null;
			pulled = 0;
		};
		const onMove = (event: TouchEvent) => {
			if (start === null || busy) return;
			if (target.scrollTop > 0) {
				start = null;
				return;
			}
			const drag = (event.touches[0]?.clientY ?? start) - start;
			if (drag <= 0) {
				if (pulled) draw(0, false);
				pulled = 0;
				return;
			}
			// Held, so the browser does not also try to bounce or scroll the page.
			event.preventDefault();
			pulled = Math.min(LIMIT, drag * RESISTANCE);
			draw(pulled, false);
		};
		const onEnd = () => {
			if (start === null || busy) return;
			start = null;
			if (pulled >= ENOUGH) {
				busy = true;
				draw(ENOUGH, true);
				light.firstElementChild?.classList.add("animate-spin");
				refresh();
				return;
			}
			draw(0, true);
			pulled = 0;
		};

		target.addEventListener("touchstart", onStart, { passive: true });
		target.addEventListener("touchmove", onMove, { passive: false });
		target.addEventListener("touchend", onEnd);
		target.addEventListener("touchcancel", onEnd);
		return () => {
			target.removeEventListener("touchstart", onStart);
			target.removeEventListener("touchmove", onMove);
			target.removeEventListener("touchend", onEnd);
			target.removeEventListener("touchcancel", onEnd);
		};
	}, [refresh]);

	return (
		<>
			<div
				ref={loader}
				data-testid="loader"
				aria-hidden="true"
				style={{ opacity: 0 }}
				className="pointer-events-none fixed inset-x-0 top-0 z-0 grid h-24 place-items-center"
			>
				<span className="size-5 border-2 border-white/20 border-t-white/80 motion-reduce:animate-none" />
			</div>
			<div ref={page} className={className}>
				{children}
			</div>
		</>
	);
}
