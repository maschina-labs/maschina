import { useEffect, useRef, useState } from "react";
import { ExternalArrow } from "./external-arrow.tsx";
import { Link } from "./i18n/link.tsx";
import { fill, label } from "./i18n/messages.ts";
import { useMessages } from "./i18n/use-messages.ts";
import { LanguageSwitcher } from "./language-switcher.tsx";
import { Logo } from "./logo.tsx";
import { openPreferences } from "./preferences.ts";
import { SITEMAP } from "./sitemap.ts";
import { SOCIALS } from "./socials.ts";
import { useStatus } from "./status.ts";
import { WORDMARK } from "./wordmark.ts";

/** How much of the wordmark shows above the bottom of the page: about three quarters of the letters. */
const SHOWN = 116;
/** On a phone the screen's bottom cuts the letters a little higher up, so more than half of them shows. */
const PHONE_SHOWN = 100;
/** How far the light from the cursor reaches, in the drawing's own units. */
const REACH = 260;

const VIEW = {
	x: WORDMARK.left,
	y: 0,
	width: WORDMARK.width - WORDMARK.left,
	height: WORDMARK.height,
};

/**
 * The wordmark as thin outlines, filled with the page's own black. It is drawn twice: once in faint grey,
 * once in pearl, and the pearl one shows only through a soft circle that follows the cursor.
 */
function Outline({ stroke }: { stroke: string }) {
	return (
		<g data-layer>
			{WORDMARK.paths.map((d) => (
				<path
					key={d}
					d={d}
					fill="black"
					stroke={stroke}
					strokeWidth={1}
					vectorEffect="non-scaling-stroke"
				/>
			))}
		</g>
	);
}

/** The color of each state: the app's own live and stop signals, grey while unknown. Its words are in the catalog. */
const COLOR = {
	checking: "bg-neutral-600",
	up: "bg-[oklch(0.8_0.2_145)] animate-blink motion-reduce:animate-none",
	paused: "bg-[oklch(0.86_0.17_100)]",
	down: "bg-[oklch(0.62_0.24_25)] animate-blink motion-reduce:animate-none",
} as const;

/** Amber for what goes out and green for what comes back, like the two activity lights on a network port. */
const TX_COLOR = "bg-[oklch(0.82_0.17_70)]";
const RX_COLOR = "bg-[oklch(0.8_0.2_145)]";

/** How long a light stays on for each piece of traffic: a blink, not a state. */
const BLINK_MS = 140;

/**
 * The answer is lit only after the request's blink is over. Against a near gateway the two happen within a few
 * milliseconds, and lit together they would read as one light; this keeps them two, in the order they happen.
 */
const RX_AFTER_MS = BLINK_MS + 60;

/**
 * One light and its label. It goes on each time `count` goes up, which is each time a real request leaves or
 * a real answer arrives, `after` milliseconds later if it is asked to wait, and off again a moment after that.
 */
function Light({
	label,
	count,
	color,
	after = 0,
}: {
	label: string;
	count: number;
	color: string;
	after?: number;
}) {
	const [lit, setLit] = useState(false);
	useEffect(() => {
		if (count === 0) return;
		const on = setTimeout(() => setLit(true), after);
		const off = setTimeout(() => setLit(false), after + BLINK_MS);
		return () => {
			clearTimeout(on);
			clearTimeout(off);
		};
	}, [count, after]);
	return (
		<span data-on={lit} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
			<span aria-hidden="true" className={`size-2 ${lit ? color : "bg-neutral-700"}`} />
			<span>{label}</span>
		</span>
	);
}

/**
 * A square dot and a word, read from the API's own status check, and two lights that blink with the traffic
 * to it: TX as the request goes out, RX as the answer comes back. Nothing here is animated for show.
 */
function StatusMark() {
	const m = useMessages();
	const { status, tx, rx } = useStatus();
	return (
		<div
			role="status"
			className="flex h-9 w-max items-center gap-3 bg-white/[0.07] px-3 text-[13px] text-neutral-300"
		>
			<span aria-hidden="true" className={`size-2 ${COLOR[status.state]}`} />
			<span>{m.footer.status[status.state]}</span>
			<span aria-hidden="true" className="h-4 w-px bg-white/10" />
			<Light label="TX" count={tx} color={TX_COLOR} />
			<Light label="RX" count={rx} color={RX_COLOR} after={RX_AFTER_MS} />
		</div>
	);
}

/** At least a screen, the sitemap near the top, and the line and the wordmark at the foot of it. */
export function Footer() {
	const m = useMessages();
	const L = (name: string) => label(m, name);
	const spot = useRef<SVGCircleElement>(null);
	const lit = useRef<SVGGElement>(null);
	// A screen with no hover has nothing to light the wordmark with, so there it lights itself: the pearl light is on
	// and sweeps across the letters, again and again, unless the reader asked for less motion, when it just rests in the
	// middle. The outline is also drawn brighter there, since a phone is held further from the eyes.
	const [touch] = useState(() => window.matchMedia?.("(hover: none)")?.matches ?? false);
	const [calm] = useState(
		() => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
	);

	// The light moves by setting attributes directly: following the cursor never re-renders the page.
	const follow = (event: React.PointerEvent<SVGSVGElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		const x = VIEW.x + ((event.clientX - box.left) / box.width) * VIEW.width;
		const y = VIEW.y + ((event.clientY - box.top) / box.height) * VIEW.height;
		spot.current?.setAttribute("cx", String(x));
		spot.current?.setAttribute("cy", String(y));
		if (lit.current) lit.current.style.opacity = "1";
	};
	const leave = () => {
		if (lit.current && !touch) lit.current.style.opacity = "0";
	};

	return (
		<footer className="relative flex min-h-lvh w-full flex-col overflow-hidden bg-black px-(--gutter) pt-16">
			<div className="flex w-full flex-col gap-12 py-12 sm:flex-row sm:items-start sm:justify-between">
				<Logo />
				{/* The map of the site: columns together on the right, up to the margin, each with its pages left aligned. The links that leave the site carry a small up-right arrow. */}
				<nav
					aria-label={m.footer.sitemap}
					className="grid grid-cols-2 gap-x-6 gap-y-10 sm:flex sm:gap-x-[clamp(2rem,5vw,6rem)]"
				>
					{SITEMAP.map((column) => (
						<div key={column.title} className="text-left">
							<h2 className="text-[12px] text-white uppercase tracking-[0.08em]">
								{L(column.title)}
							</h2>
							<ul className="mt-5 flex flex-col gap-2.5 text-[15px]">
								{column.items.map((item) =>
									item.action === "preferences" ? (
										<li key={item.label}>
											<button
												type="button"
												onClick={openPreferences}
												className="text-left text-neutral-500 transition-colors hover:text-white"
											>
												{L(item.label)}
											</button>
										</li>
									) : item.href ? (
										<li key={item.label}>
											<Link
												href={item.href}
												className="text-neutral-500 transition-colors hover:text-white"
											>
												{L(item.label)}
												{item.external ? <ExternalArrow /> : null}
											</Link>
										</li>
									) : (
										<li key={item.label} className="text-neutral-700">
											{L(item.label)}
											<span className="ml-2 text-[11px]">{m.footer.soon}</span>
										</li>
									),
								)}
							</ul>
						</div>
					))}
				</nav>
			</div>
			<div className="mt-auto flex flex-col items-center gap-4 pb-8 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
				<div data-left className="flex items-center gap-3 sm:col-start-1 sm:justify-self-start">
					{SOCIALS.map((social) => (
						<Link
							key={social.label}
							href={social.href}
							className="grid size-9 place-items-center bg-white/[0.07] text-white transition-colors hover:bg-white/[0.11]"
						>
							<span className="sr-only">{social.label}</span>
							<svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
								<path d={social.icon} />
							</svg>
						</Link>
					))}
				</div>
				<p className="text-center text-[13px] text-neutral-500 sm:col-start-2">
					{fill(m.footer.rights, { year: new Date().getFullYear() })}
				</p>
				<div data-right className="flex items-center gap-3 sm:col-start-3 sm:justify-self-end">
					<StatusMark />
					<LanguageSwitcher />
				</div>
			</div>
			<div
				style={
					{
						"--shown": `${VIEW.width} / ${SHOWN}`,
						"--phone": `${VIEW.width} / ${PHONE_SHOWN}`,
					} as React.CSSProperties
				}
				className="relative aspect-(--shown) max-sm:aspect-(--phone)"
			>
				<svg
					role="img"
					aria-label="Maschina"
					viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
					className="absolute inset-x-0 top-0 h-auto w-full"
					onPointerMove={follow}
					onPointerLeave={leave}
				>
					<defs>
						<linearGradient
							id="pearl"
							x1={WORDMARK.left}
							y1="0"
							x2={WORDMARK.width}
							y2="0"
							gradientUnits="userSpaceOnUse"
						>
							{/* Silver and pearl, the theme's own hues (the field's city palette), brighter for a hairline. */}
							<stop offset="0" stopColor="oklch(0.84 0.025 260)" />
							<stop offset="0.35" stopColor="oklch(0.96 0.03 300)" />
							<stop offset="0.65" stopColor="oklch(0.88 0.04 325)" />
							<stop offset="1" stopColor="oklch(0.9 0.03 285)" />
						</linearGradient>
						<radialGradient id="spot-fade">
							<stop offset="0" stopColor="white" />
							<stop offset="1" stopColor="black" />
						</radialGradient>
						<mask id="spot" maskUnits="userSpaceOnUse" {...VIEW}>
							<circle
								ref={spot}
								data-spot
								cx={touch ? VIEW.x + VIEW.width / 2 : -REACH * 2}
								cy={touch ? VIEW.height / 2 : -REACH * 2}
								r={REACH}
								fill="url(#spot-fade)"
							>
								{touch && !calm ? (
									<animate
										attributeName="cx"
										from={VIEW.x - REACH}
										to={VIEW.x + VIEW.width + REACH}
										dur="8s"
										repeatCount="indefinite"
									/>
								) : null}
							</circle>
						</mask>
					</defs>
					<Outline stroke={touch ? "oklch(1 0 0 / 0.3)" : "oklch(1 0 0 / 0.16)"} />
					<g
						ref={lit}
						data-lit
						mask="url(#spot)"
						style={{ opacity: touch ? 1 : 0 }}
						className="transition-opacity duration-500"
					>
						<Outline stroke="url(#pearl)" />
					</g>
				</svg>
			</div>
		</footer>
	);
}
