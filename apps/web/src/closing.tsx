import { Glint } from "./glint.tsx";
import { TryButton } from "./try-button.tsx";

/**
 * The last thing before the footer: a headline, one short line under it, and the way in, in the hero's headline
 * style and with the hero's two buttons. It is
 * a calm screen on purpose: no particles, no canvas, no motion, so there is nothing between the reader and the
 * button. The line under it is true today: a machine can be made on paper, with no money at risk.
 */
export function Closing({ authUrl }: { authUrl: string }) {
	return (
		<section
			aria-label="Get started"
			className="relative flex min-h-[70dvh] flex-col items-center justify-center overflow-hidden bg-black px-(--gutter) py-24 text-center"
		>
			{/* A soft glow along the seam with the footer, rising a little and fading out before it reaches the words. */}
			<div
				data-glow
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-[radial-gradient(60%_90%_at_50%_100%,oklch(0.9_0.02_300/0.16),transparent_70%)] [mask-image:linear-gradient(to_top,black,transparent)] [-webkit-mask-image:linear-gradient(to_top,black,transparent)]"
			/>
			<h2 className="relative -mb-[0.14em] max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] font-display font-normal text-[clamp(2.25rem,5vw,5rem)] pb-[0.14em] text-transparent leading-[1] tracking-[-0.035em] [text-wrap:balance]">
				Ready to build your first machine?
			</h2>
			<p className="relative mt-5 text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400 leading-snug">
				Test it on paper first, with no money at risk.
			</p>
			<div className="relative mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
				<TryButton
					href={`${authUrl}/sign-up`}
					label="Start for free"
					className="flex h-9 px-5 sm:inline-flex sm:pr-1"
					labelClassName="flex-1 text-center sm:text-left"
					chipClassName="size-7"
					glint
				/>
				<a
					href="/docs"
					className="group relative inline-flex h-9 items-center justify-center overflow-hidden bg-white/[0.13] px-5 text-neutral-200 transition-colors hover:bg-white/[0.18]"
				>
					<Glint tone="bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.25)_50%,transparent)]" />
					Read the docs
				</a>
			</div>
		</section>
	);
}
