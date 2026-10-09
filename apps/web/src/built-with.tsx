/**
 * What Maschina is built with, and the one thing each does for it. Every line here has to be true, and none
 * claims a relationship: these are tools in use, not partners. Names are set in text, not as logos.
 */
const TOOLS = [
	{ name: "Solana", does: "settlement", href: "https://solana.com" },
	{ name: "Turnkey", does: "signing", href: "https://www.turnkey.com" },
	{ name: "Helius", does: "RPC", href: "https://www.helius.dev" },
	{ name: "Jupiter", does: "swap routing", href: "https://jup.ag" },
	{ name: "Anthropic", does: "the manager AI", href: "https://www.anthropic.com" },
] as const;

function Row() {
	return TOOLS.map((tool) => (
		<li key={tool.name} className="shrink-0">
			<a
				href={tool.href}
				className="group flex items-baseline gap-2.5 whitespace-nowrap text-neutral-500 transition-colors hover:text-white"
			>
				<span className="text-[clamp(1.25rem,2vw,1.75rem)] tracking-[-0.02em]">{tool.name}</span>
				<span className="text-[13px] text-neutral-700 transition-colors group-hover:text-neutral-400">
					{tool.does}
				</span>
			</a>
		</li>
	));
}

/**
 * A quiet strip under the hero: what Maschina is built with, sliding slowly past. The heading says what these
 * are: tools in use, not partners. It rolls up over the pinned hero like the sections after it. The row is
 * repeated so the loop has no seam; the copy is hidden from assistive technology and the keyboard, and goes
 * altogether for anyone who asked for less motion, who gets one still row.
 */
export function BuiltWith() {
	return (
		<section aria-label="Built with" className="relative z-10 bg-black px-(--gutter) py-14">
			<h2 className="text-[12px] text-white uppercase tracking-[0.08em]">Built with</h2>
			<div
				data-frame
				className="mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
			>
				<div
					data-track
					className="flex w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:animate-none motion-reduce:flex-wrap"
				>
					<ul
						aria-label="Tools Maschina is built with"
						className="flex shrink-0 items-baseline gap-16 pr-16 motion-reduce:flex-wrap"
					>
						<Row />
					</ul>
					<ul
						data-copy
						aria-hidden="true"
						inert
						className="flex shrink-0 items-baseline gap-16 pr-16 motion-reduce:hidden"
					>
						<Row />
					</ul>
				</div>
			</div>
		</section>
	);
}
