import { Glint } from "./glint.tsx";
import { TryButton } from "./try-button.tsx";

/**
 * The last thing before the footer: what it costs to try, and the way in. Pearl white, above the pinned hero,
 * so it rolls up over it as the page scrolls. The buttons are the black ones, since pearl would vanish here.
 * Both lines are true today: a machine can be made on paper, with no money.
 */
export function Closing({ authUrl }: { authUrl: string }) {
	return (
		<section
			aria-label="Get started"
			className="relative z-10 flex min-h-[80dvh] flex-col items-center justify-center bg-[oklch(0.95_0.012_300)] px-(--gutter) py-24 text-center"
		>
			<h2 className="max-w-[16ch] font-display font-normal text-[clamp(2.25rem,5vw,5rem)] text-[oklch(0.16_0.012_285)] leading-[1] tracking-[-0.035em] [text-wrap:balance]">
				Try a machine on paper first.
			</h2>
			<p className="mt-5 text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-600 leading-snug">
				It costs nothing to try. Move to real money when you trust it.
			</p>
			<div className="mt-12 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
				<TryButton
					href={`${authUrl}/sign-up`}
					label="Start for free"
					tone="dark"
					className="flex py-2 pr-2 pl-5 sm:inline-flex"
					labelClassName="flex-1 text-left"
					chipClassName="size-7"
					glint
				/>
				<a
					href="/docs"
					className="group relative inline-flex items-center justify-center overflow-hidden bg-black/[0.07] px-5 py-3 text-neutral-800 transition-colors hover:bg-black/[0.11]"
				>
					<Glint tone="bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.7)_50%,transparent)]" />
					Read the docs
				</a>
			</div>
		</section>
	);
}
