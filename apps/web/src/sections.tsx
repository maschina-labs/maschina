import { lazy, Suspense } from "react";
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
	return (
		<section
			aria-label={name}
			className="relative flex flex-col items-center bg-black px-(--gutter) py-20 sm:py-32"
		>
			{children}
		</section>
	);
}

const GHOST =
	"inline-flex h-9 items-center justify-center bg-white/[0.13] px-5 text-neutral-200 transition-colors hover:bg-white/[0.18] max-sm:font-medium max-sm:text-white";

/** One or two buttons, in the hero's two kinds: the pearl one, then the gray one. */
function Buttons({
	primary,
	secondary,
}: {
	primary: { label: string; href: string };
	secondary?: { label: string; href: string };
}) {
	return (
		<div className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
			<TryButton
				href={primary.href}
				label={primary.label}
				className="flex h-9 px-5 sm:inline-flex sm:pr-1"
				labelClassName="flex-1 text-center sm:text-left"
				chipClassName="size-7"
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
const PANEL = "bg-white/[0.04] p-5 sm:p-6";

/** How it works: three steps, side by side from a tablet up and one under the other on a phone. */
export function HowItWorks({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.how;
	return (
		<Section name={m.name}>
			<SectionHead title={m.title} line={m.line} />
			<ol className="mt-14 grid w-full max-w-[64rem] gap-3 sm:mt-16 md:grid-cols-3">
				{m.steps.map((step, index) => (
					<li key={step.title} data-step className={`${PANEL} min-h-48`}>
						<span className="block text-[13px] text-neutral-500 tabular-nums">
							{String(index + 1).padStart(2, "0")}
						</span>
						<h3 className="mt-6 font-display font-medium text-[1.375rem] text-white tracking-[-0.015em]">
							{step.title}
						</h3>
						<p className="mt-3 text-[16px] text-neutral-400 leading-[1.55]">{step.body}</p>
					</li>
				))}
			</ol>
			<Buttons
				primary={{ label: m.primary, href: `${authUrl}/sign-up` }}
				secondary={{ label: m.secondary, href: DOCS }}
			/>
		</Section>
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
		<Section name={m.name}>
			<SectionHead title={m.title} line={m.line} />
			<ul className="mt-14 grid w-full max-w-[64rem] gap-3 sm:mt-16 sm:grid-cols-2">
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
			<Buttons primary={{ label: m.primary, href: `${authUrl}/sign-up` }} />
		</Section>
	);
}

/** Safety: the path every action takes, in four boxes, then what is kept true, and plainly that it is not audited. */
export function Safety() {
	const m = useMessages().home.safety;
	return (
		<Section name={m.name}>
			<SectionHead title={m.title} line={m.line} />
			<ol className="mt-14 grid w-full max-w-[64rem] gap-3 sm:mt-16 md:grid-cols-4">
				{m.flow.map((step, index) => (
					<li
						key={step}
						data-flow
						className="relative flex min-h-24 items-center bg-white/[0.06] p-5 text-[17px] text-white"
					>
						<span className="mr-4 text-[13px] text-neutral-500 tabular-nums">{index + 1}</span>
						{step}
					</li>
				))}
			</ol>
			<ul className="mt-3 grid w-full max-w-[64rem] gap-3 md:grid-cols-2">
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
			<p className="mt-6 max-w-[48ch] text-center text-[14px] text-neutral-500 leading-[1.6]">
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
			<Buttons primary={{ label: m.primary, href: DOCS }} />
		</Section>
	);
}

/** Customize: the settings a machine has, as square sliders, and that rearranging your own screens is still to come. */
export function Customize({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.customize;
	const positions = ["w-3/5", "w-1/4", "w-2/5", "w-3/4"];
	return (
		<Section name={m.name}>
			<SectionHead title={m.title} line={m.line} />
			<div className={`${PANEL} mt-14 w-full max-w-[40rem] space-y-6 sm:mt-16 sm:p-8`}>
				{m.settings.map((setting, index) => (
					<div key={setting} data-setting>
						<div className="flex items-center justify-between text-[14px] text-neutral-300">
							<span>{setting}</span>
						</div>
						<div className="mt-3 h-1.5 w-full bg-white/10" aria-hidden="true">
							<div
								className={`h-full bg-[oklch(0.93_0.02_300)] ${positions[index % positions.length]}`}
							/>
						</div>
					</div>
				))}
			</div>
			<p className="mt-5 text-[13px] text-neutral-500">{m.sample}</p>
			<Buttons primary={{ label: m.primary, href: `${authUrl}/sign-up` }} />
		</Section>
	);
}

/** The live record: a sample of what it will show, said to be a sample and to be on its way. */
export function LiveRecord() {
	const m = useMessages().home.live;
	return (
		<Section name={m.name}>
			<SectionHead title={m.title} line={m.line} tag={m.tag} />
			<div className={`${PANEL} mt-14 w-full max-w-[44rem] sm:mt-16`}>
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
		</Section>
	);
}

/** The network: a turning globe, and that machines running on other people's computers is not here yet. */
export function Network() {
	const m = useMessages().home.network;
	return (
		<Section name={m.name}>
			<SectionHead title={m.title} line={m.line} tag={m.tag} />
			<div className="mt-10 aspect-square w-full max-w-[34rem] sm:mt-14">
				<Suspense fallback={null}>
					<Globe label={m.globe} />
				</Suspense>
			</div>
		</Section>
	);
}

/** The marketplace: three empty places where machines will be listed, and that it is not open yet. */
export function Marketplace() {
	const m = useMessages().home.marketplace;
	return (
		<Section name={m.name}>
			<SectionHead title={m.title} line={m.line} tag={m.tag} />
			<ul className="mt-14 grid w-full max-w-[64rem] gap-3 sm:mt-16 md:grid-cols-3">
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
