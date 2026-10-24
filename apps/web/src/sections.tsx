import {
	type PaperTrade,
	PublicRecord,
	type PublicRefusal,
	type PublicTrade,
} from "@maschina/contracts";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Backdrop } from "./backdrop.tsx";
import { Link } from "./i18n/link.tsx";
import { rich } from "./i18n/rich.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS, LIVE } from "./links.ts";
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

/** The live record: real trades, paper runs and refusals, kept distinct and linked to their evidence. */
export function LiveRecord() {
	const m = useMessages().home.live;
	const [record, setRecord] = useState<ReturnType<typeof PublicRecord.parse> | null>(null);
	const [failed, setFailed] = useState(false);
	const [view, setView] = useState<"live" | "refused" | "paper">("live");

	useEffect(() => {
		let current = true;
		const read = async () => {
			try {
				const response = await fetch("https://api.maschina.dev/v1/public/record", {
					headers: { accept: "application/json" },
				});
				if (!response.ok) throw new Error("Record unavailable");
				const parsed = PublicRecord.safeParse(await response.json());
				if (!parsed.success) throw new Error("Invalid record");
				if (current) {
					setRecord(parsed.data);
					setFailed(false);
				}
			} catch {
				if (current) setFailed(true);
			}
		};
		void read();
		const interval = window.setInterval(read, 30_000);
		return () => {
			current = false;
			window.clearInterval(interval);
		};
	}, []);

	const counts = record
		? { live: record.live.length, refused: record.refused.length, paper: record.paper.length }
		: { live: 0, refused: 0, paper: 0 };
	const entries = record?.[view] ?? [];
	const tabs = [
		{ id: "live", label: m.tabs.live, count: counts.live },
		{ id: "refused", label: m.tabs.refused, count: counts.refused },
		{ id: "paper", label: m.tabs.paper, count: counts.paper },
	] as const;

	return (
		<Section name={m.name}>
			<div className="mx-auto w-full max-w-[92rem]">
				<div className="mb-8 flex flex-col gap-6 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
							{m.name}
						</p>
						<h2 className="mt-4 font-display font-normal text-[clamp(2.25rem,4.8vw,4.25rem)] text-white leading-[1.04] tracking-[-0.035em]">
							{m.title}
						</h2>
					</div>
					<Link
						href={LIVE}
						className="inline-flex h-10 items-center border border-white/[0.18] px-4 text-[14px] text-neutral-200 transition-colors hover:border-white/40 hover:text-white"
					>
						{m.open}
					</Link>
				</div>
				<div className="border border-white/[0.16] bg-black">
					<div className="flex flex-col border-b border-white/[0.14] sm:flex-row sm:items-center sm:justify-between">
						<fieldset aria-label={m.name} className="flex overflow-x-auto">
							{tabs.map((tab) => (
								<button
									key={tab.id}
									id={`record-tab-${tab.id}`}
									type="button"
									aria-pressed={view === tab.id}
									onClick={() => setView(tab.id)}
									className={`flex shrink-0 items-center gap-3 border-b px-5 py-4 text-[13px] transition-colors ${view === tab.id ? "border-white text-white" : "border-transparent text-neutral-500 hover:text-neutral-200"}`}
								>
									{tab.label}
									<span className="font-mono text-[11px] text-neutral-500">
										{record ? String(tab.count).padStart(2, "0") : "-"}
									</span>
								</button>
							))}
						</fieldset>
						<span className="px-5 pb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-600 sm:pb-0">
							{m.source}
						</span>
					</div>
					<div id="record-panel" className="overflow-x-auto">
						{!record && !failed ? (
							<p className="px-5 py-8 text-sm text-neutral-500">{m.loading}</p>
						) : null}
						{failed && !record ? (
							<p role="status" className="px-5 py-8 text-sm text-neutral-500">
								{m.unavailable}{" "}
								<a
									href={LIVE}
									className="text-neutral-300 underline underline-offset-4 hover:text-white"
								>
									{m.open}
								</a>
							</p>
						) : null}
						{record && entries.length === 0 ? (
							<p className="px-5 py-8 text-sm text-neutral-500">{m.empty[view]}</p>
						) : null}
						{record && entries.length > 0 ? (
							<RecordTable view={view} entries={entries} labels={m.columns} />
						) : null}
					</div>
					<p className="border-t border-white/[0.12] px-5 py-3 text-[11px] text-neutral-600">
						{m.note}
					</p>
				</div>
			</div>
		</Section>
	);
}

type RecordEntry = PublicTrade | PaperTrade | PublicRefusal;

function RecordTable({
	view,
	entries,
	labels,
}: {
	view: "live" | "refused" | "paper";
	entries: readonly RecordEntry[];
	labels: {
		time: string;
		side: string;
		sol: string;
		usdc: string;
		proof: string;
		gate: string;
		execution: string;
	};
}) {
	const formatAmount = (raw: string, decimals: number) => {
		const value = BigInt(raw);
		const unit = 10n ** BigInt(decimals);
		const fraction = (value % unit).toString().padStart(decimals, "0").replace(/0+$/, "");
		return fraction ? `${value / unit}.${fraction}` : `${value / unit}`;
	};
	return (
		<table className="w-full min-w-[44rem] border-collapse text-left text-[13px] tabular-nums">
			<thead>
				<tr className="border-b border-white/[0.14] font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-600">
					<th className="px-5 py-3 font-normal">{labels.time}</th>
					<th className="px-4 py-3 font-normal">{labels.side}</th>
					<th className="px-4 py-3 text-right font-normal">{labels.sol}</th>
					<th className="px-4 py-3 text-right font-normal">{labels.usdc}</th>
					<th className="px-5 py-3 text-right font-normal">
						{view === "refused" ? labels.gate : view === "paper" ? labels.execution : labels.proof}
					</th>
				</tr>
			</thead>
			<tbody>
				{entries.slice(0, 5).map((entry, index) => (
					<tr key={`${entry.at}-${index}`} className="border-b border-white/[0.08] last:border-0">
						<td className="whitespace-nowrap px-5 py-4 text-neutral-500">
							{new Date(entry.at).toLocaleString([], {
								month: "short",
								day: "numeric",
								hour: "2-digit",
								minute: "2-digit",
							})}
						</td>
						<td className="px-4 py-4 text-neutral-200">{entry.side === "buy" ? "Buy" : "Sell"}</td>
						<td className="px-4 py-4 text-right text-neutral-300">{formatAmount(entry.sol, 9)}</td>
						<td className="px-4 py-4 text-right text-neutral-300">{formatAmount(entry.usdc, 6)}</td>
						<td className="px-5 py-4 text-right">
							{"signature" in entry ? (
								<a
									href={`https://solscan.io/tx/${entry.signature}`}
									target="_blank"
									rel="noreferrer"
									className="text-neutral-400 underline underline-offset-4 hover:text-white"
								>
									{labels.proof}
								</a>
							) : "rule" in entry ? (
								<span className="text-neutral-400">
									{entry.by === "provider" ? "Provider" : "Maschina"} ·{" "}
									{entry.rule.replaceAll("_", " ")}
								</span>
							) : (
								<span className="text-neutral-600">{labels.execution}</span>
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
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

/** The network: keep the globe as the visual, and be plain that independent nodes are not live yet. */
export function Network() {
	const m = useMessages().home.network;
	return (
		<Section name={m.name}>
			<div className="mx-auto w-full max-w-[92rem]">
				<article className="grid overflow-hidden border border-white/[0.14] bg-black lg:min-h-[clamp(34rem,58lvh,42rem)] lg:grid-cols-[1.1fr_0.9fr]">
					<div className="relative order-first flex aspect-square items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,oklch(0.28_0.035_255/0.32),transparent_68%)] p-4 sm:p-8 lg:aspect-auto lg:min-h-[34rem]">
						<div className="size-full max-w-[38rem]">
							<Near>
								<Suspense fallback={null}>
									<Globe label={m.globe} />
								</Suspense>
							</Near>
						</div>
					</div>
					<div className="flex flex-col justify-center border-t border-white/[0.12] p-6 sm:p-8 lg:border-t-0 lg:border-l lg:p-10">
						<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
							{m.name}
						</p>
						<h2 className="mt-5 max-w-[15ch] font-display font-normal text-[clamp(2rem,4.8vw,4.25rem)] text-white leading-[1.04] tracking-[-0.035em] [text-wrap:balance]">
							{m.title}
						</h2>
						<p className="mt-5 max-w-[38ch] text-[15px] text-neutral-400 leading-[1.6] sm:text-base">
							{m.line}
						</p>
						<p className="mt-8 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
							{m.tag}
						</p>
					</div>
				</article>
			</div>
		</Section>
	);
}

/** Example listings span trading and the services machines can provide to one another. */
export function Marketplace() {
	const m = useMessages().home.marketplace;
	return (
		<Section name={m.name}>
			<div className="mx-auto w-full max-w-[92rem]">
				<div className="mb-10 flex flex-col gap-8 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
					<div className="max-w-3xl">
						<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
							{m.name}
						</p>
						<h2 className="mt-5 max-w-[17ch] font-display font-normal text-[clamp(2.25rem,4.8vw,4.25rem)] text-white leading-[1.04] tracking-[-0.035em] [text-wrap:balance]">
							{m.title}
						</h2>
						<p className="mt-5 max-w-[58ch] text-[15px] text-neutral-400 leading-[1.6] sm:text-base">
							{m.line}
						</p>
					</div>
					<p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
						{m.tag}
					</p>
				</div>
				<ul aria-label={m.examplesLabel} className="grid gap-5">
					{m.examples.map((example) => (
						<li key={example.name}>
							<article className="grid border border-white/[0.14] bg-black sm:min-h-[22rem] sm:grid-cols-[0.82fr_1.18fr]">
								<Backdrop className="flex min-h-60 items-end p-0! sm:min-h-0">
									<div className="relative w-full p-6 sm:p-8 lg:p-10">
										<p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-800">
											{m.exampleLabel}
										</p>
										<p className="mt-6 max-w-[8ch] font-display font-normal text-[clamp(3.5rem,8vw,7rem)] text-neutral-950 leading-[0.86] tracking-[-0.065em] [text-wrap:balance]">
											{example.visual}
										</p>
									</div>
								</Backdrop>
								<div className="flex flex-col justify-center border-t border-white/[0.12] p-6 sm:border-t-0 sm:border-l sm:p-8 lg:p-10">
									<p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
										{example.category}
									</p>
									<h3 className="mt-3 font-display font-normal text-[clamp(1.5rem,2.6vw,2.25rem)] text-white leading-[1.1] tracking-[-0.025em]">
										{example.name}
									</h3>
									<p className="mt-3 max-w-[48ch] text-[14px] text-neutral-400 leading-[1.6]">
										{example.description}
									</p>
									<dl className="mt-7 grid gap-x-6 gap-y-4 border-t border-white/[0.12] pt-5 sm:grid-cols-2">
										<div>
											<dt className="text-[11px] text-neutral-500">{m.outputLabel}</dt>
											<dd className="mt-2 text-[14px] text-neutral-200 leading-[1.4]">
												{example.output}
											</dd>
										</div>
										<div>
											<dt className="text-[11px] text-neutral-500">{m.recordLabel}</dt>
											<dd className="mt-2 text-[14px] text-neutral-200 leading-[1.4]">
												{example.record}
											</dd>
										</div>
									</dl>
								</div>
							</article>
						</li>
					))}
				</ul>
			</div>
		</Section>
	);
}
