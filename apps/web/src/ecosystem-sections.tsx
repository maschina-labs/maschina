import { ChartLine, Cpu, Database, MagnifyingGlass } from "@phosphor-icons/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";

const Globe = lazy(() => import("./globe.tsx").then((module) => ({ default: module.Globe })));
function Chapter({ name, children }: { name: string; children: React.ReactNode }) {
	return (
		<section
			aria-label={name}
			className="margin-dots relative bg-black px-(--gutter) py-20 sm:py-28"
		>
			<div
				aria-hidden="true"
				className="layout-rails pointer-events-none absolute inset-y-0 left-(--gutter) right-(--gutter) border-x border-[oklch(0.94_0.012_245/0.12)]"
			/>
			<div className="relative px-4 sm:px-8 lg:px-12">{children}</div>
		</section>
	);
}
const heading =
	"max-w-[19ch] font-display text-[clamp(2.25rem,4vw,4rem)] font-normal text-white leading-[1.08] tracking-[-0.035em]";

export function CapabilitiesSection() {
	const m = useMessages().home.capabilities;
	return (
		<Chapter name={m.name}>
			<div className="grid gap-6 lg:grid-cols-2 lg:gap-16">
				<h2 className={heading}>{m.title}</h2>
				<p className="max-w-[48ch] self-end text-base text-neutral-400 leading-relaxed">{m.line}</p>
			</div>
			<div className="mt-10 grid gap-5 lg:grid-cols-2">
				{m.groups.map((group) => (
					<article key={group.title} className="technical-surface p-6 sm:p-9">
						<span className="text-xs text-neutral-500">{group.status}</span>
						<h3 className="mt-5 font-display text-3xl text-white tracking-tight">{group.title}</h3>
						<p className="mt-5 text-neutral-400 leading-relaxed">{group.body}</p>
						<ul className="mt-8 space-y-3">
							{group.items.map((item) => (
								<li key={item} className="flex items-center gap-3 text-sm text-neutral-300">
									<span aria-hidden="true" className="size-1.5 bg-[oklch(0.88_0.012_245)]" />
									{item}
								</li>
							))}
						</ul>
					</article>
				))}
			</div>
			<Link
				href="/machines"
				className="silver-button mx-auto mt-8 flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 text-sm text-black sm:w-fit"
			>
				{m.link}
			</Link>
		</Chapter>
	);
}

export function NetworkSection() {
	const messages = useMessages();
	const m = messages.home.network;
	const details = messages.home.ecosystem;
	const holder = useRef<HTMLDivElement>(null);
	const [near, setNear] = useState(false);
	useEffect(() => {
		if (!holder.current) return;
		if (typeof IntersectionObserver === "undefined") {
			setNear(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setNear(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "300px" },
		);
		observer.observe(holder.current);
		return () => observer.disconnect();
	}, []);
	return (
		<Chapter name={m.name}>
			<div className="grid overflow-hidden bg-[oklch(0.17853_0.00407_285.98)] lg:grid-cols-2">
				<div
					ref={holder}
					className="technical-surface relative flex aspect-square items-center justify-center p-5 sm:p-8 lg:aspect-auto lg:min-h-[32rem]"
				>
					<div className="aspect-square w-full max-w-[34rem]">
						{near ? (
							<Suspense fallback={null}>
								<Globe label={m.globe} />
							</Suspense>
						) : null}
					</div>
				</div>
				<div className="flex flex-col justify-center p-6 sm:p-10">
					<p className="text-xs text-neutral-500">{m.tag}</p>
					<h2 className={`${heading} mt-5`}>{m.title}</h2>
					<p className="mt-6 text-neutral-400 leading-relaxed">{details.networkBody}</p>
					<p className="mt-6 text-sm text-neutral-500 leading-relaxed">{details.globeNote}</p>
					<Link
						href="/network"
						className="silver-button mx-auto mt-8 flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 text-sm text-black sm:w-fit"
					>
						{details.networkLink}
					</Link>
				</div>
			</div>
		</Chapter>
	);
}

export function MarketplaceSection() {
	const messages = useMessages();
	const m = messages.home.marketplace;
	const details = messages.home.ecosystem;
	const icons = [ChartLine, Database, MagnifyingGlass, Cpu];
	return (
		<Chapter name={m.name}>
			<p className="mb-5 text-xs text-neutral-500">{m.tag}</p>
			<div className="grid gap-6 lg:grid-cols-2 lg:gap-16">
				<h2 className={heading}>{m.title}</h2>
				<p className="max-w-[48ch] self-end text-neutral-400 leading-relaxed">
					{details.marketBody}
				</p>
			</div>
			<ul aria-label={m.examplesLabel} className="mt-10 grid gap-5 sm:grid-cols-2">
				{m.examples.map((example, index) => {
					const Icon = icons[index] ?? Cpu;
					return (
						<li key={example.name} className="technical-surface p-6 sm:p-8">
							<div className="flex items-start justify-between gap-6">
								<div
									aria-hidden="true"
									className="grid size-16 place-items-center bg-[linear-gradient(145deg,oklch(0.96_0.008_245),oklch(0.77_0.012_245))] text-[oklch(0.2_0_0)] shadow-[6px_8px_18px_oklch(0_0_0/0.25)]"
								>
									<Icon className="size-8" weight="light" />
								</div>
								<span className="text-xs text-neutral-500">{m.exampleLabel}</span>
							</div>
							<p className="mt-8 text-xs text-neutral-500">{example.category}</p>
							<h3 className="mt-3 font-display text-2xl text-white tracking-tight">
								{example.name}
							</h3>
							<p className="mt-4 max-w-[44ch] text-sm text-neutral-400 leading-relaxed">
								{example.description}
							</p>
						</li>
					);
				})}
			</ul>
			<p className="mt-6 text-xs text-neutral-500 leading-relaxed">{details.examplesNote}</p>
			<Link
				href="/marketplace"
				className="silver-button mx-auto mt-8 flex min-h-12 w-full items-center justify-center gap-2 px-6 py-3 text-sm text-black sm:w-fit"
			>
				{details.marketLink}
			</Link>
		</Chapter>
	);
}
