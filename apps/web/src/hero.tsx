import { type CSSProperties, lazy, Suspense, useEffect, useRef, useState } from "react";
import { TILES } from "./tiles.ts";
import { TryButton } from "./try-button.tsx";

// The ribbon is WebGL and pulls in three.js, which is heavy: it loads after the words are on screen, so the
// page never waits for it.
const Ribbon = lazy(() =>
	import("@maschina/field").then((module) => ({ default: module.FogBackground })),
);

/** How far a piece at depth 1 travels with the cursor, and with the page, in pixels. */
const REACH_X = 28;
const REACH_Y = 20;
const SCROLL_RATE = -0.12;

const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A number with no trailing noise, and never "-0". */
const clean = (value: number) => String(Number(value.toFixed(3)) || 0);

/**
 * The first screen: the words and the two buttons, centered, over the silver and pearl ribbon with the pieces
 * of the operating system floating around them. Every claim on it can be checked: the record is public.
 *
 * The pieces move with the cursor, and with the page as it scrolls, each by its own depth: the section holds
 * three numbers (--px, --py and --sy) and every piece works out its own travel from them in CSS, so moving
 * the cursor never re-renders anything. A finger is not a cursor, so touch moves only with scrolling, and
 * nothing moves for anyone who asks their system for less motion.
 */
export function Hero({ authUrl }: { authUrl: string }) {
	const section = useRef<HTMLElement>(null);
	const [ready, setReady] = useState(false);

	useEffect(() => setReady(true), []);

	useEffect(() => {
		const onScroll = () => {
			if (still()) return;
			section.current?.style.setProperty("--sy", clean(Math.round(window.scrollY)));
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const aim = (x: number, y: number) => {
		section.current?.style.setProperty("--px", clean(x));
		section.current?.style.setProperty("--py", clean(y));
	};

	return (
		<section
			ref={section}
			aria-label="Maschina"
			onPointerMove={(event) => {
				if (event.pointerType === "touch" || still()) return;
				const box = event.currentTarget.getBoundingClientRect();
				const across = Math.min(1, Math.max(-1, ((event.clientX - box.left) / box.width) * 2 - 1));
				const down = Math.min(1, Math.max(-1, ((event.clientY - box.top) / box.height) * 2 - 1));
				aim(across, down);
			}}
			onPointerLeave={() => aim(0, 0)}
			className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-(--gutter) pt-24 pb-16 text-center"
		>
			<div aria-hidden="true" className="pointer-events-none absolute inset-0">
				{ready ? (
					<Suspense fallback={null}>
						<Ribbon position="absolute" field="ribbon" motion="calm" mode="dark" />
					</Suspense>
				) : null}
				{/* Dimmed so the words read, and melting into the page at the bottom. */}
				<div className="absolute inset-0 bg-[oklch(0_0_0/0.5)]" />
				<div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-black" />
			</div>

			{TILES.map((tile) => (
				<div
					key={tile.name}
					data-tile={tile.name}
					data-depth={tile.depth}
					aria-hidden="true"
					style={
						{
							"--d": tile.depth,
							"--r": tile.tilt,
							transform: `translate3d(calc(var(--px, 0) * var(--d) * ${REACH_X}px), calc(var(--py, 0) * var(--d) * ${REACH_Y}px + var(--sy, 0) * var(--d) * ${SCROLL_RATE}px), 0) rotate(var(--r))`,
						} as CSSProperties
					}
					className={`pointer-events-none absolute z-10 w-44 bg-[linear-gradient(180deg,oklch(1_0_0/0.12),oklch(1_0_0/0.04))] p-4 text-left shadow-[inset_0_1px_0_oklch(1_0_0/0.16)] transition-transform duration-500 ease-out will-change-transform md:w-56 ${tile.place}`}
				>
					<p className="text-[11px] text-neutral-500 uppercase tracking-[0.2em]">{tile.name}</p>
					<p className="mt-2 text-[15px] text-[oklch(0.9_0.012_300)] leading-snug">{tile.title}</p>
					<p className="mt-1.5 text-[13px] text-neutral-400 leading-snug">{tile.body}</p>
				</div>
			))}

			<h1 className="relative z-20 max-w-[18ch] font-display font-normal text-[clamp(2rem,4.6vw,5rem)] text-[oklch(0.97_0.012_300)] leading-[0.98] tracking-[-0.035em] [text-wrap:balance]">
				The operating system for autonomous capital.
			</h1>
			<p className="relative z-20 mt-6 max-w-[40ch] text-[clamp(1rem,1.35vw,1.25rem)] text-[oklch(0.74_0.012_285)] leading-snug">
				AI decides. Maschina decides what it's allowed to do.
			</p>
			<div className="relative z-20 mt-10 flex flex-wrap items-stretch justify-center gap-3 text-[15px]">
				<TryButton
					href={`${authUrl}/sign-up`}
					className="inline-flex py-2 pr-2 pl-5"
					labelClassName=""
					chipClassName="size-7"
				/>
				<a
					href="/live"
					className="inline-flex items-center bg-white/[0.13] px-5 text-neutral-200 transition-colors hover:bg-white/[0.18]"
				>
					See the live record
				</a>
			</div>
			<p className="relative z-20 mt-8 max-w-[48ch] text-[13px] text-neutral-500 leading-relaxed">
				Range Finder has traded real money on Solana since September 28. Every trade is on chain.
			</p>
		</section>
	);
}
