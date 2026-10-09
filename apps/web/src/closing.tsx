import { Glint } from "./glint.tsx";
import { TryButton } from "./try-button.tsx";

/**
 * The last thing before the footer: one line and the way in, the hero's headline and the hero's two buttons. It is
 * a calm screen on purpose: no particles, no canvas, no motion, so there is nothing between the reader and the
 * button. The line is true today: a machine can be made on paper, with no money.
 */
export function Closing({ authUrl }: { authUrl: string }) {
	return (
		<section
			aria-label="Get started"
			className="relative flex min-h-[70dvh] flex-col items-center justify-center bg-black px-(--gutter) py-24 text-center"
		>
			<h2 className="max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] font-display font-normal text-[clamp(2.25rem,5vw,5rem)] text-transparent leading-[1] tracking-[-0.035em] [text-wrap:balance]">
				Try a machine on paper first.
			</h2>
			<div className="mt-12 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
				<TryButton
					href={`${authUrl}/sign-up`}
					label="Start for free"
					className="flex h-9 pr-1 pl-5 sm:inline-flex"
					labelClassName="flex-1 text-left"
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
