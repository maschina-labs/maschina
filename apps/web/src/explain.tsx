/**
 * Right after the screenshot, in plain words: what Maschina is. The screenshot shows what it looks like; this
 * says what it is, in the order a newcomer asks (what, how, why, how to start), so someone scrolling down
 * understands it as fast as it can be read. Every line is a claim about the product and has to be true: a
 * machine has its own wallet and works on its own, it holds no keys and can only pay the owner, the AI only
 * proposes, rules check every trade before it is signed, trades settle on Solana, and a machine can be made on
 * paper with no money. It is big type on black with a small colored square beside each label: no widgets, no
 * animation, nothing to click.
 */
const ROWS = [
	{
		label: "What it is",
		sentence:
			"Maschina lets you give an AI its own wallet and a job, like trading SOL, and it works on its own, around the clock.",
		marker: "bg-[oklch(0.8_0.11_300)]",
	},
	{
		label: "What it does",
		sentence:
			"Each machine reads the market, decides, and trades inside limits you set. It never holds your keys, and it can only ever pay you.",
		marker: "bg-[oklch(0.82_0.06_250)]",
	},
	{
		label: "Why you can trust it",
		sentence:
			"The AI only proposes. Rules check every trade before it is signed, and every trade settles on Solana, where anyone can check it.",
		marker: "bg-[oklch(0.83_0.1_215)]",
	},
	{
		label: "How to start",
		sentence: "Start on paper, with no money. Move to real money when you trust it.",
		marker: "bg-[oklch(0.82_0.17_150)]",
	},
] as const;

export function Explain() {
	return (
		<section aria-label="What Maschina is" className="relative bg-black px-(--gutter) py-32">
			<ul aria-label="What Maschina is" className="flex flex-col gap-12">
				{ROWS.map((row) => (
					<li key={row.label} className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr] lg:gap-10">
						<div className="flex items-center gap-3 self-start lg:pt-3">
							<span data-marker aria-hidden="true" className={`size-2.5 shrink-0 ${row.marker}`} />
							<h3 className="text-[13px] text-neutral-500 uppercase tracking-[0.08em]">
								{row.label}
							</h3>
						</div>
						<p className="max-w-[34ch] font-display font-normal text-[clamp(1.5rem,2.6vw,2.5rem)] text-white leading-[1.2] tracking-[-0.02em] lg:max-w-[40ch]">
							{row.sentence}
						</p>
					</li>
				))}
			</ul>
		</section>
	);
}
