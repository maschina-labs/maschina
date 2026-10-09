import { useRef } from "react";
import { COLUMNS, SOCIALS } from "./sitemap.ts";
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

/** Only languages the site is written in are offered. English, until a translation is real. */
const LANGUAGES = [{ code: "en", name: "English" }];

function Language() {
	return (
		<label className="relative flex items-center gap-2 bg-white/[0.07] py-2 pr-8 pl-3 text-neutral-300 transition-colors hover:bg-white/[0.11]">
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
			<select
				aria-label="Language"
				defaultValue="en"
				className="cursor-pointer appearance-none bg-transparent text-neutral-300 outline-none"
			>
				{LANGUAGES.map((language) => (
					<option
						key={language.code}
						value={language.code}
						label={language.code.toUpperCase()}
						className="bg-black"
					>
						{language.name}
					</option>
				))}
			</select>
			<svg
				viewBox="0 0 24 24"
				className="pointer-events-none absolute right-3 size-[12px]"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				aria-hidden="true"
			>
				<path d="m6 9 6 6 6-6" />
			</svg>
		</label>
	);
}

/** What each state says, and its color: the app's own live and stop signals, grey while unknown. */
const SHOWN_AS = {
	checking: { label: "Checking", color: "bg-neutral-600" },
	up: { label: "All systems normal", color: "bg-[oklch(0.8_0.2_145)]" },
	paused: { label: "Machines paused", color: "bg-[oklch(0.82_0.16_85)]" },
	down: { label: "API unreachable", color: "bg-[oklch(0.65_0.21_35)]" },
} as const;

/** A square dot and a word, read from the API's own status check every minute. */
function StatusMark() {
	const status = useStatus();
	const shown = SHOWN_AS[status.state];
	return (
		<div
			role="status"
			className="flex w-max items-center gap-2.5 bg-white/[0.07] px-3 py-2 text-[13px] text-neutral-300"
		>
			<span aria-hidden="true" className={`size-2 ${shown.color}`} />
			<span>{shown.label}</span>
		</div>
	);
}

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
		<footer className="relative w-full overflow-hidden px-6 sm:px-[4vw]">
			<div className="flex flex-col gap-14 pt-20 pb-16 lg:flex-row lg:justify-between">
				<div className="flex flex-col gap-6">
					<img src="/brand/favicon.svg" alt="Maschina mark" className="size-8" />
					<p className="max-w-[28ch] text-[14px] text-neutral-400 leading-relaxed">
						The operating system for autonomous capital.
					</p>
				</div>
				<div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-5 sm:gap-x-16">
					{COLUMNS.map((column) => (
						<nav key={column.name} aria-label={column.name} className="flex flex-col gap-4">
							<span className="text-[13px] text-neutral-200">{column.name}</span>
							<ul className="flex flex-col gap-3">
								{column.links.map((link) => (
									<li key={link.label}>
										<a
											href={link.href}
											className="text-[14px] text-neutral-500 transition-colors hover:text-neutral-100"
										>
											{link.label}
										</a>
									</li>
								))}
							</ul>
						</nav>
					))}
				</div>
			</div>
			<div className="flex flex-col items-center gap-5 border-white/[0.06] border-t py-6 text-[13px] text-neutral-500 lg:grid lg:grid-cols-[1fr_auto_1fr]">
				<div className="flex items-center gap-5 lg:justify-self-start">
					{SOCIALS.map((social) => (
						<a
							key={social.label}
							href={social.href}
							className="transition-colors hover:text-neutral-100"
						>
							<span className="sr-only">{social.label}</span>
							<svg
								viewBox="0 0 24 24"
								className="size-[18px]"
								fill="currentColor"
								aria-hidden="true"
							>
								<path d={social.icon} />
							</svg>
						</a>
					))}
				</div>
				<p>© {new Date().getFullYear()} Maschina Labs. All rights reserved.</p>
				<div className="flex items-center gap-3 lg:justify-self-end">
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
