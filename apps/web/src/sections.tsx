import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "./i18n/link.tsx";
import { rich } from "./i18n/rich.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS } from "./links.ts";
import { SectionHead } from "./section-head.tsx";
import { TryButton } from "./try-button.tsx";

// The globe pulls in the map libraries, so it loads after the page is on screen and the page never waits for it.
const Globe = lazy(() => import("./globe.tsx").then((module) => ({ default: module.Globe })));

/** The frame every section sits in: black, between the page margins, centered, with room above and below. */
function Section({ name, children }: { name: string; children: React.ReactNode }) {
	// One listener for the whole section: the card under the mouse learns where the mouse is inside it, for its dots. A finger
	// has no hover, so it is ignored.
	const follow = (event: React.PointerEvent<HTMLElement>) => {
		if (event.pointerType === "touch") return;
		const card = (event.target as HTMLElement).closest<HTMLElement>(".card-dots");
		if (!card) return;
		const box = card.getBoundingClientRect();
		card.style.setProperty("--mx", `${event.clientX - box.left}px`);
		card.style.setProperty("--my", `${event.clientY - box.top}px`);
	};
	return (
		<section
			aria-label={name}
			onPointerMove={follow}
			className="relative flex flex-col items-center overflow-hidden bg-black px-(--gutter) py-20 sm:py-32"
		>
			{children}
		</section>
	);
}

const GHOST =
	"inline-flex h-10 items-center justify-center bg-white/[0.13] xl:h-8 px-5 text-neutral-200 transition-colors hover:bg-white/[0.18] max-sm:font-medium max-sm:text-white";

/** One or two buttons, in the hero's two kinds: the pearl one, then the gray one. */
function Buttons({
	primary,
	secondary,
	left = false,
}: {
	primary: { label: string; href: string };
	secondary?: { label: string; href: string };
	/** Start at the left edge, for a chapter, instead of in the middle. */
	left?: boolean;
}) {
	return (
		<div
			className={`mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row ${left ? "sm:justify-start" : "sm:justify-center"}`}
		>
			<TryButton
				href={primary.href}
				label={primary.label}
				className="flex h-10 px-5 sm:inline-flex sm:pr-1 xl:h-8"
				labelClassName="flex-1 text-center sm:text-left"
				chipClassName="size-7 xl:size-6"
			/>
			{secondary ? (
				<Link href={secondary.href} className={GHOST}>
					{secondary.label}
				</Link>
			) : null}
		</div>
	);
}

/** A square panel, the one shape every visual here is made of. */
const PANEL = "card-dots bg-white/[0.04] p-5 sm:p-6";

/**
 * A chapter of the story: the words in one column and a visual in the other, from a large screen up, and the words and
 * then the visual on a phone. The words are left-aligned, so every headline down the page starts at the same edge, and
 * `flip` moves the visual to the other side for rhythm. It takes the buttons last, so they sit under the words.
 */
function Chapter({
	name,
	head,
	buttons,
	flip = false,
	children,
}: {
	name: string;
	head: React.ReactNode;
	buttons?: React.ReactNode;
	flip?: boolean;
	children: React.ReactNode;
}) {
	const chapter = useRef<HTMLDivElement>(null);
	// Shown at once where the browser cannot watch for scrolling, so nothing is ever hidden for good.
	const [seen, setSeen] = useState(typeof IntersectionObserver === "undefined");
	useEffect(() => {
		const node = chapter.current;
		if (seen || !node) return;
		const watcher = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				setSeen(true);
				// It arrives once. Scrolling back up never hides it again.
				watcher.disconnect();
			},
			{ threshold: 0.15 },
		);
		watcher.observe(node);
		return () => watcher.disconnect();
	}, [seen]);
	const arrive =
		"transition duration-700 ease-out motion-reduce:transition-none group-data-[seen=false]/chapter:translate-y-6 group-data-[seen=false]/chapter:opacity-0";
	return (
		<Section name={name}>
			<div
				ref={chapter}
				data-chapter
				data-seen={seen}
				className="group/chapter grid w-full gap-12 lg:grid-cols-2 lg:items-center lg:gap-20"
			>
				{/* Pearl light behind the visual, faint, drifting slowly, on the side the visual is on. */}
				<div
					data-glow
					aria-hidden="true"
					className={`pointer-events-none absolute top-1/2 size-[28rem] animate-drift bg-[radial-gradient(closest-side,oklch(0.93_0.02_300/0.1),transparent)] motion-reduce:animate-none lg:size-[44rem] ${flip ? "left-[-14rem] lg:left-[-8rem]" : "right-[-14rem] lg:right-[-8rem]"}`}
				/>
				<div data-words className={`flex flex-col items-start ${arrive}`}>
					{head}
					{buttons}
				</div>
				<div data-visual className={`relative delay-150 ${arrive} ${flip ? "lg:order-first" : ""}`}>
					{children}
				</div>
			</div>
		</Section>
	);
}

/** How it works: three steps, one under the other beside the words. */
export function HowItWorks({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.how;
	return (
		<Chapter
			name={m.name}
			head={<SectionHead title={m.title} line={m.line} align="left" />}
			buttons={
				<Buttons
					left
					primary={{ label: m.primary, href: `${authUrl}/sign-up` }}
					secondary={{ label: m.secondary, href: DOCS }}
				/>
			}
		>
			<ol className="grid gap-3">
				{m.steps.map((step, index) => (
					<li key={step.title} data-step className={`${PANEL} flex gap-5 sm:gap-6`}>
						<span className="text-[13px] text-neutral-500 tabular-nums">
							{String(index + 1).padStart(2, "0")}
						</span>
						<div>
							<h3 className="font-display font-medium text-[1.375rem] text-white tracking-[-0.015em]">
								{step.title}
							</h3>
							<p className="mt-2 text-[16px] text-neutral-400 leading-[1.55]">{step.body}</p>
						</div>
					</li>
				))}
			</ol>
		</Chapter>
	);
}

/** A thin line chart in the page's own colors, drawn from a handful of points. The shape is only a sample. */
function Sparkline() {
	return (
		<svg viewBox="0 0 200 60" className="h-16 w-full" fill="none" aria-hidden="true">
			<path
				d="M0 46 L22 40 L44 44 L66 30 L88 34 L110 20 L132 26 L154 12 L176 18 L200 6"
				stroke="oklch(0.9 0.02 300)"
				strokeWidth="1.5"
				vectorEffect="non-scaling-stroke"
			/>
			<path d="M0 59 H200" stroke="oklch(1 0 0 / 0.12)" strokeWidth="1" />
		</svg>
	);
}

/** Rows of a pretend record: a pale bar for what was done and a dimmer one for the reason. */
function Rows({ count }: { count: number }) {
	return (
		<div className="space-y-2.5" aria-hidden="true">
			{Array.from({ length: count }, (_, row) => (
				<div key={row} className="flex items-center gap-3">
					<span className="size-2 shrink-0 bg-white/30" />
					<span className="h-2 w-2/5 bg-white/20" />
					<span className="h-2 w-1/5 bg-white/10" />
				</div>
			))}
		</div>
	);
}

/** A pretend conversation: square bubbles, one short and one longer, one from each side. */
function Chat() {
	return (
		<div className="space-y-2.5" aria-hidden="true">
			<div className="ml-auto h-6 w-3/5 bg-white/15" />
			<div className="h-6 w-4/5 bg-white/[0.08]" />
			<div className="h-6 w-2/5 bg-white/[0.08]" />
		</div>
	);
}

/** Inside the app: four tiles, each with a small picture of the part of the app it names. */
export function Features({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.inside;
	const pictures = [
		<Sparkline key="a" />,
		<Rows key="b" count={4} />,
		<Chat key="c" />,
		<Rows key="d" count={5} />,
	];
	return (
		<Chapter
			name={m.name}
			flip
			head={<SectionHead title={m.title} line={m.line} align="left" />}
			buttons={<Buttons left primary={{ label: m.primary, href: `${authUrl}/sign-up` }} />}
		>
			<ul className="grid gap-3 sm:grid-cols-2">
				{m.tiles.map((tile, index) => (
					<li key={tile.title} data-tile className={`${PANEL} flex flex-col gap-6`}>
						<div className="flex min-h-24 items-center">{pictures[index]}</div>
						<div>
							<h3 className="font-display font-medium text-[1.375rem] text-white tracking-[-0.015em]">
								{tile.title}
							</h3>
							<p className="mt-2 text-[16px] text-neutral-400 leading-[1.55]">{tile.body}</p>
						</div>
					</li>
				))}
			</ul>
			<p className="mt-5 text-[13px] text-neutral-500">{m.sample}</p>
		</Chapter>
	);
}

/** Safety: the path every action takes, in four boxes, then what is kept true, and plainly that it is not audited. */
export function Safety() {
	const m = useMessages().home.safety;
	return (
		<Chapter
			name={m.name}
			head={
				<>
					<SectionHead title={m.title} line={m.line} align="left" />
					<p className="mt-6 max-w-[48ch] text-left text-[14px] text-neutral-500 leading-[1.6]">
						{rich(m.audit, {
							link: (
								<Link
									href="/risk"
									className="text-neutral-300 underline decoration-white/30 underline-offset-4 hover:decoration-white"
								>
									{m.auditLink}
								</Link>
							),
						})}
					</p>
				</>
			}
			buttons={<Buttons left primary={{ label: m.primary, href: DOCS }} />}
		>
			<ol className="grid gap-3 sm:grid-cols-2">
				{m.flow.map((step, index) => (
					<li
						key={step}
						data-flow
						className="card-dots relative flex min-h-24 items-center bg-white/[0.06] p-5 text-[17px] text-white"
					>
						<span className="mr-4 text-[13px] text-neutral-500 tabular-nums">{index + 1}</span>
						{step}
					</li>
				))}
			</ol>
			<ul className="mt-3 grid gap-3">
				{m.points.map((point) => (
					<li
						key={point}
						data-point
						className={`${PANEL} text-[17px] text-neutral-300 leading-[1.5]`}
					>
						{point}
					</li>
				))}
			</ul>
		</Chapter>
	);
}

/** Customize: the settings a machine has, as square sliders, and that rearranging your own screens is still to come. */
export function Customize({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.customize;
	const positions = ["w-3/5", "w-1/4", "w-2/5", "w-3/4"];
	return (
		<Chapter
			name={m.name}
			flip
			head={<SectionHead title={m.title} line={m.line} align="left" />}
			buttons={<Buttons left primary={{ label: m.primary, href: `${authUrl}/sign-up` }} />}
		>
			<div className={`${PANEL} space-y-6 sm:p-8`}>
				{m.settings.map((setting, index) => (
					<div key={setting} data-setting>
						<div className="flex items-center justify-between text-[14px] text-neutral-300">
							<span>{setting}</span>
						</div>
						{/* The line draws from the left, and its fill follows; each row starts a beat after the one above. */}
						<div
							data-track
							aria-hidden="true"
							style={{ transitionDelay: `${index * 180}ms` }}
							className="mt-3 h-1.5 w-full origin-left bg-white/10 transition-transform duration-700 ease-out motion-reduce:transition-none group-data-[seen=false]/chapter:scale-x-0"
						>
							<div
								data-fill
								style={{ transitionDelay: `${index * 180 + 350}ms` }}
								className={`h-full origin-left bg-[oklch(0.93_0.02_300)] transition-transform duration-1000 ease-out motion-reduce:transition-none group-data-[seen=false]/chapter:scale-x-0 ${positions[index % positions.length]}`}
							/>
						</div>
					</div>
				))}
			</div>
			<p className="mt-5 text-[13px] text-neutral-500">{m.sample}</p>
		</Chapter>
	);
}

/** The live record: a sample of what it will show, said to be a sample and to be on its way. */
export function LiveRecord() {
	const m = useMessages().home.live;
	return (
		<Chapter
			name={m.name}
			head={<SectionHead title={m.title} line={m.line} tag={m.tag} align="left" />}
		>
			<div className={PANEL}>
				<ul className="divide-y divide-white/[0.06]">
					{m.rows.map((row) => (
						<li
							key={`${row.time}${row.action}`}
							data-row
							className="flex flex-wrap items-baseline gap-x-5 gap-y-1 py-3 text-[15px]"
						>
							<span className="text-neutral-500 tabular-nums">{row.time}</span>
							<span className="text-white">{row.action}</span>
							<span className="text-neutral-400 sm:ml-auto">{row.outcome}</span>
						</li>
					))}
				</ul>
			</div>
			<p className="mt-5 text-[13px] text-neutral-500">{m.sample}</p>
		</Chapter>
	);
}

/**
 * Renders its children once it is near the screen, so what is heavy (the globe's map libraries) is not fetched while the
 * page is opening. Where the browser cannot watch for scrolling it renders at once, so nothing is ever left out.
 */
function Near({ children }: { children: React.ReactNode }) {
	const box = useRef<HTMLDivElement>(null);
	const [near, setNear] = useState(typeof IntersectionObserver === "undefined");
	useEffect(() => {
		const node = box.current;
		if (near || !node) return;
		const watcher = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				setNear(true);
				watcher.disconnect();
			},
			{ rootMargin: "800px 0px" },
		);
		watcher.observe(node);
		return () => watcher.disconnect();
	}, [near]);
	return (
		<div ref={box} data-near={near} className="size-full">
			{near ? children : null}
		</div>
	);
}

/** The network: a turning globe, and that machines running on other people's computers is not here yet. */
export function Network() {
	const m = useMessages().home.network;
	return (
		<Chapter
			name={m.name}
			flip
			head={<SectionHead title={m.title} line={m.line} tag={m.tag} align="left" />}
		>
			<div className="mx-auto aspect-square w-full max-w-[34rem]">
				<Near>
					<Suspense fallback={null}>
						<Globe label={m.globe} />
					</Suspense>
				</Near>
			</div>
		</Chapter>
	);
}

/** The marketplace: three empty places where machines will be listed, and that it is not open yet. */
export function Marketplace() {
	const m = useMessages().home.marketplace;
	return (
		<Section name={m.name}>
			<div className="flex w-full flex-col items-start">
				<SectionHead title={m.title} line={m.line} tag={m.tag} align="left" />
			</div>
			<ul className="mt-14 grid w-full gap-3 sm:mt-16 md:grid-cols-3">
				{m.cards.map((card, index) => (
					<li key={index} data-card className={`${PANEL} min-h-44 opacity-70`}>
						<span className="block text-[14px] text-neutral-500">{card}</span>
						<div className="mt-8 space-y-2.5" aria-hidden="true">
							<div className="h-2 w-4/5 bg-white/15" />
							<div className="h-2 w-3/5 bg-white/10" />
							<div className="h-2 w-2/5 bg-white/10" />
						</div>
					</li>
				))}
			</ul>
		</Section>
	);
}
