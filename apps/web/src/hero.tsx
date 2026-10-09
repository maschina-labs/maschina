import { lazy, Suspense, useEffect, useState } from "react";
import { TryButton } from "./try-button.tsx";

// The ribbon is WebGL and pulls in three.js, which is heavy: it loads after the page is on screen, so the
// page never waits for it.
const Ribbon = lazy(() =>
	import("@maschina/field").then((module) => ({ default: module.FogBackground })),
);

/**
 * The first screen: the silver and pearl ribbon behind the headline, and two buttons under it: start for
 * free, and the docs. (The live record is in the header.) The line under the headline and the floating pieces
 * were tried and taken out (the last version with them is in the history); they come back one at a time. The ribbon fades in once it has loaded. Its layers are decoration,
 * so they are hidden from assistive technology.
 */
export function Hero({ authUrl }: { authUrl: string }) {
	const [ready, setReady] = useState(false);

	useEffect(() => setReady(true), []);

	return (
		<section
			aria-label="Maschina"
			className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-(--gutter) pt-24 pb-16 text-center"
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
			<h1 className="relative z-20 max-w-[18ch] font-display font-normal text-[clamp(2.25rem,5.4vw,6rem)] text-[oklch(0.97_0.012_300)] leading-[0.98] tracking-[-0.035em] [text-wrap:balance]">
				The operating system for autonomous capital.
			</h1>
			<p className="relative z-20 mt-6 max-w-[34ch] text-[clamp(1rem,1.4vw,1.25rem)] text-neutral-400 leading-snug [text-wrap:balance]">
				AI decides. Maschina decides what it's allowed to do.
			</p>
			<div className="relative z-20 mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
				<TryButton
					href={`${authUrl}/sign-up`}
					label="Start for free"
					className="flex py-2 pr-2 pl-5 sm:inline-flex"
					labelClassName="flex-1 text-left"
					chipClassName="size-7"
				/>
				<a
					href="/docs"
					className="inline-flex items-center justify-center bg-white/[0.13] px-5 py-3 text-neutral-200 transition-colors hover:bg-white/[0.18]"
				>
					Read the docs
				</a>
			</div>
			<p className="relative z-20 mt-8 text-[13px] text-neutral-500">
				<a href="/live" className="transition-colors hover:text-neutral-300">
					Range Finder has traded real money on Solana since September 28.
				</a>
			</p>
		</section>
	);
}
