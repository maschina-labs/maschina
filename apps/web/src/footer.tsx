import { useEffect, useRef, useState } from "react";
import { Logo } from "./logo.tsx";
import { usePresence } from "./presence.ts";
import { SITEMAP } from "./sitemap.ts";
import { SOCIALS } from "./socials.ts";
import { useStatus } from "./status.ts";
import { WORDMARK } from "./wordmark.ts";

/** How much of the wordmark shows above the bottom of the page: about three quarters of the letters. */
const SHOWN = 116;
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

/**
 * The languages offered, each under its own name, English first. Choosing one is only a choice for now: the
 * site itself is written in English until the translations exist.
 */
const LANGUAGES = [
	{ code: "en", name: "English" },
	{ code: "es", name: "Español" },
	{ code: "fr", name: "Français" },
	{ code: "de", name: "Deutsch" },
	{ code: "it", name: "Italiano" },
	{ code: "pt", name: "Português" },
	{ code: "nl", name: "Nederlands" },
	{ code: "pl", name: "Polski" },
	{ code: "tr", name: "Türkçe" },
	{ code: "ru", name: "Русский" },
	{ code: "uk", name: "Українська" },
	{ code: "ar", name: "العربية" },
	{ code: "he", name: "עברית" },
	{ code: "hi", name: "हिन्दी" },
	{ code: "bn", name: "বাংলা" },
	{ code: "zh", name: "简体中文" },
	{ code: "zh-tw", name: "繁體中文" },
	{ code: "ja", name: "日本語" },
	{ code: "ko", name: "한국어" },
	{ code: "id", name: "Bahasa Indonesia" },
	{ code: "vi", name: "Tiếng Việt" },
	{ code: "th", name: "ไทย" },
	{ code: "fil", name: "Filipino" },
] as const;

/** How long the popover takes to leave, so it fades away rather than blinking out. */
const POPOVER_EXIT_MS = 180;

function Language() {
	const [open, setOpen] = useState(false);
	const [chosen, setChosen] = useState("en");
	const root = useRef<HTMLDivElement>(null);
	const button = useRef<HTMLButtonElement>(null);
	const popover = usePresence(
		open,
		window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : POPOVER_EXIT_MS,
	);

	// Escape and a press anywhere outside close it. Neither listens while it is shut.
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
		const onPress = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onPress);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onPress);
		};
	}, [open]);

	return (
		<div ref={root} className="relative">
			<button
				ref={button}
				type="button"
				aria-label="Language"
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((now) => !now)}
				className="flex h-9 items-center gap-2 bg-white/[0.07] pr-3 pl-3 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.11]"
			>
				<svg
					viewBox="0 0 24 24"
					className="size-[14px]"
					fill="none"
					stroke="currentColor"
					strokeWidth={1.5}
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="9" />
					<path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
				</svg>
				<span>{chosen.toUpperCase()}</span>
				<svg
					viewBox="0 0 24 24"
					className={`size-[12px] transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
					fill="none"
					stroke="currentColor"
					strokeWidth={1.5}
					aria-hidden="true"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
			{popover.mounted ? (
				<div
					className={`absolute right-0 bottom-full z-10 mb-2 w-56 bg-[oklch(0.2_0.008_285)] transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${popover.visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
				>
					<div
						role="listbox"
						aria-label="Language"
						className="flex max-h-72 flex-col overflow-y-auto p-1"
					>
						{LANGUAGES.map((language) => (
							<button
								key={language.code}
								type="button"
								role="option"
								aria-selected={chosen === language.code}
								onClick={() => {
									setChosen(language.code);
									setOpen(false);
									button.current?.focus();
								}}
								className="flex items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.08] hover:text-neutral-100"
							>
								<span>{language.name}</span>
								<span
									data-box
									className={`grid size-4 shrink-0 place-items-center border ${chosen === language.code ? "border-transparent bg-[oklch(0.93_0.02_300)] text-black" : "border-white/25"}`}
								>
									{chosen === language.code ? (
										<svg
											viewBox="0 0 24 24"
											className="size-3"
											fill="none"
											stroke="currentColor"
											strokeWidth={3}
											strokeLinecap="square"
											aria-hidden="true"
										>
											<path d="m5 12.5 4.5 4.5L19 7.5" />
										</svg>
									) : null}
								</span>
							</button>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}

/** What each state says, and its color: the app's own live and stop signals, grey while unknown. */
const SHOWN_AS = {
	checking: { label: "Checking", color: "bg-neutral-600" },
	up: {
		label: "All systems normal",
		color: "bg-[oklch(0.8_0.2_145)] animate-blink motion-reduce:animate-none",
	},
	paused: { label: "Machines paused", color: "bg-[oklch(0.86_0.17_100)]" },
	down: {
		label: "API unreachable",
		color: "bg-[oklch(0.62_0.24_25)] animate-blink motion-reduce:animate-none",
	},
} as const;

/** Green, like the activity light on a network port. The label says which direction it is. */
const ACTIVITY = "bg-[oklch(0.8_0.2_145)]";

/** How long a light stays on for each piece of traffic: a blink, not a state. */
const BLINK_MS = 220;

/**
 * One light and its label. It goes on each time `count` goes up, which is each time a real request leaves or
 * a real answer arrives, and off again a moment later.
 */
function Light({ label, count, color }: { label: string; count: number; color: string }) {
	const [lit, setLit] = useState(false);
	useEffect(() => {
		if (count === 0) return;
		setLit(true);
		const off = setTimeout(() => setLit(false), BLINK_MS);
		return () => clearTimeout(off);
	}, [count]);
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
	const { status, tx, rx } = useStatus();
	const shown = SHOWN_AS[status.state];
	return (
		<div
			role="status"
			className="flex h-9 w-max items-center gap-3 bg-white/[0.07] px-3 text-[13px] text-neutral-300"
		>
			<span aria-hidden="true" className={`size-2 ${shown.color}`} />
			<span>{shown.label}</span>
			<span aria-hidden="true" className="h-4 w-px bg-white/10" />
			<Light label="TX" count={tx} color={ACTIVITY} />
			<Light label="RX" count={rx} color={ACTIVITY} />
		</div>
	);
}

/** A full screen, with the wordmark at the foot of it. It sits above the pinned hero and rolls up over it. */
export function Footer() {
	const spot = useRef<SVGCircleElement>(null);
	const lit = useRef<SVGGElement>(null);

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
		if (lit.current) lit.current.style.opacity = "0";
	};

	return (
		<footer className="relative z-10 flex min-h-dvh w-full flex-col justify-end overflow-hidden bg-black px-(--gutter) pt-32">
			<div className="my-auto flex w-full flex-col gap-12 py-16 sm:flex-row sm:items-start sm:justify-between">
				<Logo />
				{/* The map of the site: columns together on the right, up to the margin, each with its pages left aligned. The links that leave the site carry a small up-right arrow. */}
				<nav
					aria-label="Sitemap"
					className="grid grid-cols-2 gap-x-6 gap-y-12 sm:flex sm:gap-x-[clamp(3rem,8vw,8rem)]"
				>
					{SITEMAP.map((column) => (
						<div key={column.title} className="text-left">
							<h2 className="text-[12px] text-white uppercase tracking-[0.08em]">{column.title}</h2>
							<ul className="mt-4 flex flex-col gap-2.5 text-[15px]">
								{column.items.map((item) =>
									item.href ? (
										<li key={item.label}>
											<a
												href={item.href}
												className="text-neutral-500 transition-colors hover:text-white"
											>
												{item.label}
												{item.external ? (
													<svg
														viewBox="0 0 12 12"
														data-arrow="external"
														className="ml-1.5 inline size-3"
														fill="none"
														stroke="currentColor"
														strokeWidth={1.25}
														strokeLinecap="square"
														aria-hidden="true"
													>
														<path d="M3.5 8.5 8.5 3.5M4 3.5h4.5V8" />
													</svg>
												) : null}
											</a>
										</li>
									) : (
										<li key={item.label} className="text-neutral-700">
											{item.label}
											<span className="ml-2 text-[11px]">Soon</span>
										</li>
									),
								)}
							</ul>
						</div>
					))}
				</nav>
			</div>
			<div className="flex flex-col items-center gap-4 pb-6 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
				<div data-left className="flex items-center gap-3 sm:col-start-1 sm:justify-self-start">
					{SOCIALS.map((social) => (
						<a
							key={social.label}
							href={social.href}
							className="grid size-9 place-items-center bg-white/[0.07] text-white transition-colors hover:bg-white/[0.11]"
						>
							<span className="sr-only">{social.label}</span>
							<svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
								<path d={social.icon} />
							</svg>
						</a>
					))}
				</div>
				<p className="text-center text-[13px] text-neutral-500 sm:col-start-2">
					© {new Date().getFullYear()} Maschina Labs. All rights reserved.
				</p>
				<div data-right className="flex items-center gap-3 sm:col-start-3 sm:justify-self-end">
					<StatusMark />
					<Language />
				</div>
			</div>
			<div style={{ aspectRatio: `${VIEW.width} / ${SHOWN}` }} className="relative">
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
								cx={-REACH * 2}
								cy={-REACH * 2}
								r={REACH}
								fill="url(#spot-fade)"
							/>
						</mask>
					</defs>
					<Outline stroke="oklch(1 0 0 / 0.16)" />
					<g
						ref={lit}
						data-lit
						mask="url(#spot)"
						style={{ opacity: 0 }}
						className="transition-opacity duration-500"
					>
						<Outline stroke="url(#pearl)" />
					</g>
				</svg>
			</div>
		</footer>
	);
}
