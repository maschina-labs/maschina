import { lazy, Suspense, useEffect, useState } from "react";
import { Glint } from "./glint.tsx";
import { TryButton } from "./try-button.tsx";

// Like the hero's ribbon, the particles are WebGL and pull in three.js: they load after the page is up.
const Particles = lazy(() =>
	import("@maschina/field").then((module) => ({ default: module.FogBackground })),
);

/**
 * The last thing before the footer: what it costs to try, and the way in. Dark like the rest of the page, above
 * the pinned hero, so it rolls up over it as the page scrolls. The headline and the buttons are the hero's.
 * Particles drift behind it. Both lines are true today: a machine can be made on paper, with no money.
 */
export function Closing({ authUrl }: { authUrl: string }) {
	const [ready, setReady] = useState(false);

	useEffect(() => setReady(true), []);

	return (
		<section
			aria-label="Get started"
			className="relative z-10 flex min-h-[80dvh] flex-col items-center justify-center overflow-hidden bg-black px-(--gutter) py-24 text-center"
		>
			<div aria-hidden="true" className="pointer-events-none absolute inset-0">
				{ready ? (
					<Suspense fallback={null}>
						<div className="absolute inset-0 animate-fade-in motion-reduce:animate-none">
							<Particles position="absolute" field="particles" motion="calm" mode="dark" />
						</div>
					</Suspense>
				) : null}
			</div>
			<h2 className="relative z-20 max-w-[16ch] font-display font-normal text-[clamp(2.25rem,5vw,5rem)] text-transparent bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] leading-[1] tracking-[-0.035em] [text-wrap:balance]">
				Try a machine on paper first.
			</h2>
			<p className="relative z-20 mt-5 text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400 leading-snug">
				It costs nothing to try. Move to real money when you trust it.
			</p>
			<div className="relative z-20 mt-12 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
				<TryButton
					href={`${authUrl}/sign-up`}
					label="Start for free"
					className="flex py-2 pr-2 pl-5 sm:inline-flex"
					labelClassName="flex-1 text-left"
					chipClassName="size-7"
					glint
				/>
				<a
					href="/docs"
					className="group relative inline-flex items-center justify-center overflow-hidden bg-white/[0.13] px-5 py-3 text-neutral-200 transition-colors hover:bg-white/[0.18]"
				>
					<Glint tone="bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.25)_50%,transparent)]" />
					Read the docs
				</a>
			</div>
		</section>
	);
}
