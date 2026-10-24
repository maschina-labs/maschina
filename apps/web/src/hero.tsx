import { CaretRight } from "@phosphor-icons/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS } from "./links.ts";
import { TryButton } from "./try-button.tsx";

// The ribbon is WebGL and pulls in three.js, which is heavy: it loads after the page is on screen, so the
// page never waits for it.
const Ribbon = lazy(() =>
	import("@maschina/field").then((module) => ({ default: module.FogBackground })),
);

/**
 * The first screen: the silver and
 * pearl ribbon is behind the headline, with one line saying what it does, two buttons (start for free, the
 * docs) and one plain line of facts at the foot (source-available, built on Solana: each true today; the chip above the headline says it is free to try on paper). The floating pieces were tried and taken out (the last
 * version with them is in the history). The ribbon fades in once it has loaded. Its layers are decoration, so
 * they are hidden from assistive technology.
 */
export function Hero({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.hero;
	const [ready, setReady] = useState(false);

	// The ribbon is three.js, so it waits for the page to finish loading and the browser to be idle: it never competes with
	// the first paint or the fonts.
	useEffect(() => {
		let handle = 0;
		const start = () => {
			handle = window.requestIdleCallback
				? window.requestIdleCallback(() => setReady(true), { timeout: 2500 })
				: window.setTimeout(() => setReady(true), 200);
		};
		if (document.readyState === "complete") start();
		else window.addEventListener("load", start, { once: true });
		return () => {
			window.removeEventListener("load", start);
			if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
			else window.clearTimeout(handle);
		};
	}, []);
	return (
		<section
			aria-label={m.name}
			className="relative flex h-lvh min-h-[36rem] flex-col items-start justify-center overflow-hidden px-(--gutter) pt-32 pb-[calc(4rem+100lvh-100svh)] text-left"
		>
			<div aria-hidden="true" className="pointer-events-none absolute inset-0">
				{ready ? (
					<Suspense fallback={null}>
						<div className="absolute inset-0 animate-fade-in motion-reduce:animate-none">
							<Ribbon position="absolute" field="ribbon" motion="calm" mode="dark" />
						</div>
					</Suspense>
				) : null}
				{/* Dimmed so what goes on top of it reads, and melting into the page at the bottom. */}
				<div data-dim className="absolute inset-0 bg-[oklch(0_0_0/0.5)]" />
				<div
					data-melt
					className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-black"
				/>
			</div>
			<h1 className="relative z-20 -mb-[0.14em] max-w-none pb-[0.14em] font-display font-normal text-[clamp(1.6rem,8.4vw,2.5rem)] sm:text-[clamp(2.5rem,6.4vw,7.5rem)] text-transparent bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] leading-[0.98] tracking-[-0.035em] [text-wrap:balance]">
				<span className="block">{m.headlineTop}</span>{" "}
				<span className="block">{m.headlineBottom}</span>
			</h1>
			<p className="relative z-20 mt-8 max-w-[56ch] text-[clamp(1rem,1.2vw,1.125rem)] text-neutral-400 leading-[1.7] [text-wrap:pretty] sm:mt-10">
				{m.line}
			</p>
			<div className="relative z-20 mt-14 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-start">
				<TryButton
					href={`${authUrl}/sign-up`}
					label={m.start}
					className="flex h-10 px-5 sm:inline-flex sm:pr-1 xl:h-8 [--silver-fill:linear-gradient(110deg,oklch(0.8_0.025_250),oklch(0.94_0.018_250)_30%,oklch(0.99_0.006_250)_48%,oklch(0.88_0.03_250)_70%,oklch(0.79_0.035_250))]"
					labelClassName="flex-1 text-center sm:text-left"
					chipClassName="size-7 xl:size-6"
				/>
				<Link
					href={DOCS}
					className="inline-flex h-10 items-center justify-center gap-2 px-3 text-neutral-200 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white xl:h-8 max-sm:font-medium max-sm:text-white"
				>
					<span>{m.docs}</span>
					<CaretRight aria-hidden="true" className="size-4 shrink-0 translate-y-px" weight="bold" />
				</Link>
			</div>
			<p className="absolute inset-x-0 bottom-[calc(2rem+100lvh-100svh)] z-20 px-(--gutter) text-center md:text-left text-[13px] text-neutral-500">
				{m.facts}
			</p>
		</section>
	);
}
