import { TryButton } from "./try-button.tsx";

/**
 * The first screen, built layer by layer: the words and the two buttons come first, centered, and the
 * background and the floating pieces come after. Every claim on it can be checked: the record is public.
 */
export function Hero({ authUrl }: { authUrl: string }) {
	return (
		<section
			aria-label="Maschina"
			className="flex min-h-dvh flex-col items-center justify-center px-(--gutter) pt-24 pb-16 text-center"
		>
			<h1 className="max-w-[18ch] font-display font-normal text-[clamp(2rem,4.6vw,5rem)] text-[oklch(0.97_0.012_300)] leading-[0.98] tracking-[-0.035em] [text-wrap:balance]">
				The operating system for autonomous capital.
			</h1>
			<p className="mt-6 max-w-[40ch] text-[clamp(1rem,1.35vw,1.25rem)] text-[oklch(0.74_0.012_285)] leading-snug">
				AI decides. Maschina decides what it's allowed to do.
			</p>
			<div className="mt-10 flex flex-wrap items-stretch justify-center gap-3 text-[15px]">
				<TryButton
					href={`${authUrl}/sign-up`}
					className="inline-flex py-2 pr-2 pl-5"
					labelClassName=""
					chipClassName="size-7"
				/>
				<a
					href="/live"
					className="inline-flex items-center bg-white/[0.13] px-5 text-neutral-200 transition-colors hover:bg-white/[0.18]"
				>
					See the live record
				</a>
			</div>
			<p className="mt-8 max-w-[48ch] text-[13px] text-neutral-500 leading-relaxed">
				Range Finder has traded real money on Solana since September 28. Every trade is on chain.
			</p>
		</section>
	);
}
