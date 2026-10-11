/**
 * The head every front page section shares: the pearl headline with the thin outline, then one gray line, centered. It
 * is the same headline as the hero's and the other sections', so a section is its head and whatever it shows below.
 */
export function SectionHead({
	title,
	line,
	tag,
}: {
	title: string;
	line: string;
	/** A small word under the line, such as Coming soon, for what is not built yet. */
	tag?: string;
}) {
	return (
		<>
			<h2 className="-mb-[0.14em] max-w-[18ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-center font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
				{title}
			</h2>
			<p className="mt-6 max-w-[48ch] text-center text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400 leading-snug [text-wrap:balance]">
				{line}
			</p>
			{tag ? (
				<p data-tag className="mt-4 bg-white/[0.08] px-3 py-1 text-[12px] text-neutral-300">
					{tag}
				</p>
			) : null}
		</>
	);
}
