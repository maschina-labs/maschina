/**
 * The first screen: what Maschina is, in one line, centered. Everything else on this screen (the floating
 * pieces, the buttons) comes after, one at a time.
 */
export function Hero() {
	return (
		<section
			aria-label="Maschina"
			className="flex min-h-dvh items-center justify-center px-(--gutter)"
		>
			<h1 className="max-w-[14ch] text-center font-display font-normal text-[clamp(2.75rem,7.6vw,8rem)] text-[oklch(0.97_0.012_300)] leading-[0.98] tracking-[-0.035em] [text-wrap:balance]">
				The operating system for autonomous capital.
			</h1>
		</section>
	);
}
