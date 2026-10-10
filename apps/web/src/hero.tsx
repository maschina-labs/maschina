import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Glint } from "./glint.tsx";
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
 * docs) and one plain line of facts at the foot (source-available, built on Solana, free to try on paper: each true today). The floating pieces were tried and taken out (the last
 * version with them is in the history). The ribbon fades in once it has loaded. Its layers are decoration, so
 * they are hidden from assistive technology.
 */
export function Hero({ authUrl }: { authUrl: string }) {
	const [ready, setReady] = useState(false);

	useEffect(() => setReady(true), []);
	const heading = useRef<HTMLHeadingElement>(null);

	// The light on the letters follows the mouse by setting two properties directly: moving the cursor never
	// re-renders the page. A finger and anyone who asked for less motion get the still sheen instead.
	const follow = (event: React.PointerEvent<HTMLElement>) => {
		const node = heading.current;
		if (!node || event.pointerType === "touch") return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const box = node.getBoundingClientRect();
		if (box.width === 0 || box.height === 0) return;
		node.style.setProperty("--mx", `${((event.clientX - box.left) / box.width) * 100}%`);
		node.style.setProperty("--my", `${((event.clientY - box.top) / box.height) * 100}%`);
	};
	const leave = () => {
		heading.current?.style.removeProperty("--mx");
		heading.current?.style.removeProperty("--my");
	};

	return (
		<section
			aria-label="Maschina"
			onPointerMove={follow}
			onPointerLeave={leave}
			className="relative flex h-lvh min-h-[36rem] flex-col items-center justify-center overflow-hidden px-(--gutter) pt-32 pb-[calc(4rem+100lvh-100svh)] text-center"
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
			<h1
				ref={heading}
				className="relative z-20 -mb-[0.14em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] max-w-none pb-[0.14em] font-display font-normal max-sm:-mx-4 text-[clamp(1.6rem,8.4vw,2.5rem)] sm:text-[clamp(2.5rem,6.4vw,7.5rem)] text-transparent bg-clip-text bg-[radial-gradient(circle_18rem_at_var(--mx,50%)_var(--my,-100%),oklch(1_0_0/0.9),transparent),linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] [filter:drop-shadow(0_0_28px_oklch(0.95_0.01_260/0.28))] leading-[0.98] tracking-[-0.035em] [text-wrap:balance]"
			>
				<span className="block">The operating system for</span>{" "}
				<span className="block">autonomous capital.</span>
			</h1>
			<p className="relative z-20 mt-4 text-[clamp(0.9375rem,1.2vw,1.125rem)] text-neutral-400 leading-snug [text-wrap:balance] sm:whitespace-nowrap">
				AI decides. Maschina decides what it's allowed to do.
			</p>
			<div className="relative z-20 mt-14 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
				<TryButton
					href={`${authUrl}/sign-up`}
					label="Start for free"
					className="flex h-9 px-5 sm:inline-flex sm:pr-1"
					labelClassName="flex-1 text-center sm:text-left"
					chipClassName="size-7"
					glint
				/>
				<a
					href={DOCS}
					className="group relative inline-flex items-center justify-center overflow-hidden bg-white/[0.13] px-5 h-9 text-neutral-200 transition-colors hover:bg-white/[0.18] max-sm:font-medium max-sm:text-white"
				>
					<Glint tone="bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.25)_50%,transparent)]" />
					Read the docs
				</a>
			</div>
			<p className="absolute inset-x-0 bottom-[calc(2rem+100lvh-100svh)] z-20 px-(--gutter) text-[13px] text-neutral-500">
				Source-available, built on Solana, free to try on paper.
			</p>
		</section>
	);
}
