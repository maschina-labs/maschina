import { List } from "@phosphor-icons/react";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { IDLE_MS, onIdleNow, useIdleMode } from "../lib/idle.ts";
import { preview } from "../lib/preview.ts";
import { useSession } from "../lib/session.ts";
import { Account } from "./account.tsx";
import { Bento, Tile } from "./bento.tsx";
import { openEdge } from "./edges.tsx";
import { Greeting } from "./greeting.tsx";
import { HomeTiles } from "./home.tsx";
import { NetworkTiles } from "./network.tsx";
import {
	ActivityTiles,
	InsightsTiles,
	MachinesTiles,
	MarketplaceTiles,
	PortfolioTiles,
	SwapTiles,
} from "./pages.tsx";
import { SECTIONS, Sections } from "./sections.tsx";

/**
 * Every section side by side on one strip, as on the Xbox 360 dashboard. Moving between them slides the
 * strip; the greeting, the account and the row of sections stay where they are.
 *
 * Only the page you are on and its neighbors are drawn. The rest are empty until you come near, so no
 * matter how many sections there are, at most three are ever built.
 *
 * Each page still has its own address, so a link to a section is a link to that view.
 */

/** Which section a path belongs to, or -1 for a page that is not one. */
export function sectionIndex(path: string): number {
	// Its own address only. A screen under a section, a node or a listing, opens over it instead.
	const bare = path.length > 1 ? path.replace(/\/$/, "") : path;
	return SECTIONS.findIndex((section) => bare === section.to);
}

/** What each section shows. The mockup's empty tiles, until each is given its job. */
const PAGES: Record<string, () => ReactNode> = {
	"/": HomeTiles,
	"/insights": InsightsTiles,
	"/portfolio": PortfolioTiles,
	"/machines": MachinesTiles,
	"/activity": ActivityTiles,
	"/swap": SwapTiles,
	"/marketplace": MarketplaceTiles,
	"/network": NetworkTiles,
};
const page = (to: string) => PAGES[to] ?? EmptyTiles;

/** How far a sideways scroll or swipe has to go before it counts as a move. */
const SWIPE = 60;
/** Idle mode: how long it rests on each page, and how slowly it slides on. */
const DWELL_MS = 14_000;
/** After idle mode starts, how long before anything can stop it, so the click that started it does not. */
const GRACE_MS = 1_500;
const DRIFT_MS = 1_600;
/** How long a move takes, which is also how long before another can start. */
const SLIDE_MS = 520;

/**
 * `behind` is the section to show when the page asked for is not a section, such as a machine opened in
 * the detail layer: the deck stays where you left it, underneath.
 */
export function Deck({ behind }: { behind?: string } = {}) {
	// For seeing the error screen while developing: ?break breaks the deck on purpose.
	if (preview("break") !== undefined) {
		throw new Error("A test of the error screen: ?break is in the address.");
	}
	const { api } = useRouter().options.context;
	const wallet = useSession(api).data?.walletAddress;
	const current = useRouterState({ select: (state) => state.location.pathname });
	const path = sectionIndex(current) >= 0 ? current : (behind ?? "/");
	const navigate = useNavigate();
	const at = Math.max(sectionIndex(path), 0);
	const count = SECTIONS.length;
	const wrap = (index: number) => ((index % count) + count) % count;
	/**
	 * Where the strip is, counted without end: the section shown is this position wrapped round. Moving
	 * on from Network goes to position 8, which is Home again, so the strip never slides back across
	 * every page. A jump to a section by name goes the shorter way round.
	 */
	const [position, setPosition] = useState(at);
	useEffect(() => {
		setPosition((was) => {
			const from = wrap(was);
			if (from === at) return was;
			let delta = at - from;
			if (delta > count / 2) delta -= count;
			if (delta < -count / 2) delta += count;
			return was + delta;
		});
	}, [at, count]);
	const busy = useRef(false);
	const wheel = useRef(0);
	// A trackpad keeps sending its glide after the fingers lift. One swipe is one move, and the next swipe
	// can follow straight away, without waiting for the trackpad to go still.
	const gesture = useRef({ lockedUntil: 0, waitForRise: false, last: 0, low: 0 });
	// Where a mouse press started, for dragging the strip to the next page.
	const drag = useRef<number | undefined>(undefined);

	const go = (step: number) => {
		const to = SECTIONS[wrap(at + step)];
		if (!to || busy.current) return;
		busy.current = true;
		setTimeout(() => {
			busy.current = false;
		}, SLIDE_MS);
		void navigate({ to: to.to });
	};

	/**
	 * Idle mode: once nothing has been touched for a while, the dashboard drifts on by itself, a page at a
	 * time, slowly, round and round. A thin bar along the bottom fills while it rests on a page, so you
	 * can see the next move coming. Any touch, key or movement stops it at once.
	 */
	const idle = useIdleMode();
	const [drifting, setDrifting] = useState(false);
	// Bumped on every rest, so the bar starts filling again from nothing.
	const [rest, setRest] = useState(0);
	const step = useRef(go);
	step.current = go;
	// Only the dashboard's own pages drift. A screen open over them, like the manager mid conversation or
	// a form half filled in, is being used even when nothing moves.
	const onDeck = useRef(true);
	onDeck.current = sectionIndex(current) >= 0;
	useEffect(() => {
		// Switched off: whatever was drifting stops.
		if (!idle) setDrifting(false);
		let last = Date.now();
		let on = false;
		let since = 0;
		let restStart = 0;
		let from = { x: 0, y: 0 };
		let pointer = { x: 0, y: 0 };
		const begin = () => {
			on = true;
			since = Date.now();
			restStart = since;
			from = pointer;
			setDrifting(true);
			setRest((was) => was + 1);
		};
		// Real use stops it: a click, a key, a scroll, or the mouse moving properly. The click that started
		// it, and the small drift of a hand leaving the mouse, do not count.
		const stir = (event: Event) => {
			if (event instanceof PointerEvent && event.type === "pointermove") {
				pointer = { x: event.clientX, y: event.clientY };
				if (on && Math.hypot(pointer.x - from.x, pointer.y - from.y) < 40) return;
			}
			if (on && Date.now() - since < GRACE_MS) return;
			last = Date.now();
			if (on) {
				on = false;
				setDrifting(false);
			}
		};
		const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
		for (const name of events) window.addEventListener(name, stir, { passive: true });
		const stop = onIdleNow(() => {
			// Asked for now: start straight away, the switch having just been turned on.
			begin();
		});
		const timer = setInterval(() => {
			const now = Date.now();
			if (!on) {
				if (idle && onDeck.current && now - last >= IDLE_MS) begin();
				return;
			}
			if (now - restStart < DWELL_MS) return;
			restStart = now;
			setRest((was) => was + 1);
			step.current(1);
		}, 500);
		return () => {
			clearInterval(timer);
			stop();
			for (const name of events) window.removeEventListener(name, stir);
		};
	}, [idle]);

	// A swipe on a touch screen. Once a finger is clearly going sideways the page is held still, so the
	// slide never drifts diagonally; one going up or down scrolls the tiles as usual.
	const surface = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const element = surface.current;
		if (!element) return;
		let start: { x: number; y: number; sideways?: boolean } | undefined;
		const onStart = (event: TouchEvent) => {
			const first = event.touches[0];
			// A swipe that starts in the header or on the sections is not a swipe of the page.
			if (!first || (event.target as HTMLElement).closest("header, nav, [data-own-drag]")) {
				start = undefined;
				return;
			}
			start = { x: first.clientX, y: first.clientY };
		};
		const onMove = (event: TouchEvent) => {
			const now = event.touches[0];
			if (!start || !now) return;
			const dx = Math.abs(now.clientX - start.x);
			const dy = Math.abs(now.clientY - start.y);
			// Decided once, on the first clear movement, and kept for the rest of the touch.
			if (start.sideways === undefined && (dx > 8 || dy > 8)) start.sideways = dx > dy;
			if (start.sideways) event.preventDefault();
		};
		const onEnd = (event: TouchEvent) => {
			const last = event.changedTouches[0];
			const began = start;
			start = undefined;
			if (!began?.sideways || !last) return;
			const dx = last.clientX - began.x;
			if (Math.abs(dx) > SWIPE) step.current(dx < 0 ? 1 : -1);
		};
		element.addEventListener("touchstart", onStart, { passive: true });
		element.addEventListener("touchmove", onMove, { passive: false });
		element.addEventListener("touchend", onEnd, { passive: true });
		return () => {
			element.removeEventListener("touchstart", onStart);
			element.removeEventListener("touchmove", onMove);
			element.removeEventListener("touchend", onEnd);
		};
	}, []);

	// The arrow keys move a page, unless something is being typed.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			// A key pressed with nothing focused comes from the window itself, which is not typing anywhere.
			const typing =
				event.target instanceof Element && event.target.closest("input, textarea, select");
			if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
			if (event.key === "ArrowLeft") go(-1);
			if (event.key === "ArrowRight") go(1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	return (
		<div
			className="flex h-full select-none flex-col overflow-hidden"
			// A sideways scroll on a trackpad moves a page once it has gone far enough.
			onWheel={(event) => {
				// Scrolling on something that scrolls itself, such as the chart, is its own.
				if ((event.target as HTMLElement).closest("[data-own-drag]")) return;
				if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
				const now = gesture.current;
				const size = Math.abs(event.deltaX);
				const at = performance.now();
				// While the page slides, nothing counts.
				if (at < now.lockedUntil) {
					now.last = size;
					now.low = Math.min(now.low, size);
					return;
				}
				// After a move, the glide left over from that swipe dies away. A new swipe speeds up hard. The
				// glide jitters, so one event a little larger than the last is not a new swipe: it has to be
				// at least twice the slowest the glide reached, and clearly faster, before it counts. A glide
				// that was taken for a new swipe is what moved two pages for one.
				if (now.waitForRise) {
					now.low = Math.min(now.low, size);
					const rising = size >= now.low * 2 && size - now.low >= 8 && size > now.last;
					now.last = size;
					if (!rising) return;
					now.waitForRise = false;
					wheel.current = 0;
				}
				now.last = size;
				wheel.current += event.deltaX;
				if (Math.abs(wheel.current) < SWIPE) return;
				go(wheel.current > 0 ? 1 : -1);
				wheel.current = 0;
				now.lockedUntil = at + SLIDE_MS * 0.6;
				now.waitForRise = true;
				now.low = size;
			}}
			// With a mouse, click and drag sideways. A press that barely moves is still an ordinary click.
			onPointerDown={(event) => {
				// Pressing on a control, or on something that is dragged itself such as the globe, is not a drag
				// of the page.
				if ((event.target as HTMLElement).closest("header, nav, button, a, input, [data-own-drag]"))
					return;
				if (event.pointerType === "mouse" && event.button === 0) drag.current = event.clientX;
			}}
			onPointerUp={(event) => {
				const start = drag.current;
				drag.current = undefined;
				if (start === undefined || event.pointerType !== "mouse") return;
				const dx = event.clientX - start;
				if (Math.abs(dx) > SWIPE) go(dx < 0 ? 1 : -1);
			}}
			ref={surface}
		>
			<div className="flex shrink-0 justify-center px-5 pt-[max(env(safe-area-inset-top),24px)] md:px-0 md:pt-[8vh]">
				<div className="w-full md:w-[calc(var(--u)*6+50px)] md:[--u:min(calc((86cqw-50px)/6),calc((66cqh-20px)/3))]">
					<header className="flex items-center justify-between gap-6">
						<Greeting wallet={wallet} />
						<Account />
						{/* On a phone, every section is one tap away in the menu. */}
						<button
							type="button"
							aria-label="Sections"
							onClick={() => openEdge("sections")}
							className="grid size-11 place-items-center bg-white/[0.11] text-neutral-100 backdrop-blur-xl transition-colors duration-300 active:bg-white/[0.2] md:hidden"
						>
							<List size={22} weight="light" />
						</button>
					</header>
					<div className="mt-9 mb-5 md:mt-[5vh] md:mb-3">
						<Sections />
					</div>
				</div>
			</div>
			<div className="relative min-h-0 flex-1">
				<div
					className="absolute inset-0 transition-transform"
					style={{
						transform: `translateX(-${position * 100}%)`,
						// Drifting by itself, the slide is slow and even; moved by hand, quick and decelerating.
						transitionDuration: `${drifting ? DRIFT_MS : SLIDE_MS}ms`,
						transitionTimingFunction: drifting
							? "cubic-bezier(0.45, 0, 0.25, 1)"
							: "cubic-bezier(0.32, 0.72, 0, 1)",
					}}
				>
					{[position - 1, position, position + 1].map((place) => {
						const section = SECTIONS[wrap(place)];
						if (!section) return null;
						const Content = page(section.to);
						return (
							<div
								key={place}
								aria-hidden={place !== position}
								style={{ left: `${place * 100}%` }}
								// On a phone the tiles scroll, clear of the dock at the bottom.
								className="no-scrollbar absolute top-0 h-full w-full overflow-y-auto overscroll-y-contain px-5 pb-32 md:overflow-hidden md:px-0 md:pb-10"
							>
								<div className="flex justify-center">
									<Bento label={section.label}>
										<Content />
									</Bento>
								</div>
							</div>
						);
					})}
				</div>
			</div>
			{/* While drifting, a thin bar along the bottom fills over each rest. */}
			{drifting ? (
				<div aria-hidden="true" className="fixed inset-x-0 bottom-0 z-20 h-[2px] bg-white/10">
					<div
						key={rest}
						className="h-full bg-white/60"
						style={{ animation: `rest ${DWELL_MS}ms linear forwards` }}
					/>
				</div>
			) : null}
		</div>
	);
}

/** The mockup's layout, empty. */
function EmptyTiles() {
	return (
		<>
			{/* For now, three tiles open sample screens, to feel the flip. Each gets its real one with content. */}
			<Tile to="/settings" label="Settings" />
			<Tile to="/new" label="New machine" />
			<Tile size="wide" to="/machines/sample" label="Machine" />
			<Tile size="wide" />
			<Tile />
			<Tile />
			<Tile size="wide" />
			<Tile size="wide" />
			<Tile size="wide" />
			<Tile size="wide" />
			<Tile size="wide" />
		</>
	);
}
