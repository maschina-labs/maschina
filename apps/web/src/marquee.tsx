import { useMessages } from "./i18n/use-messages.ts";

/**
 * What Maschina really runs on: the chain, the swap router, the signing service, the node provider, the host and the
 * database. Each is the company's own file, unmodified, shown gray and dim by a filter and in its own colors on hover. The
 * ones that are only a symbol get the name set beside them; Solana, Turnkey and Helius already spell it. `w` and `h` are the size it is shown at, in pixels.
 */
const STACK = [
	{ name: "Solana", file: "solana", w: 175, h: 26, word: false },
	{ name: "Jupiter", file: "jupiter", w: 27, h: 26, word: true },
	{ name: "Turnkey", file: "turnkey", w: 100, h: 26, word: false },
	{ name: "Helius", file: "helius", w: 133, h: 28, word: false },
	{ name: "Cloudflare", file: "cloudflare", w: 34, h: 34, word: true },
	{ name: "PostgreSQL", file: "postgresql", w: 30, h: 30, word: true },
];

/** One copy of the marks, as a list. The hidden copy is only there to close the loop, so its pictures say nothing. */
function Copy({ hidden }: { hidden?: boolean }) {
	return (
		<ul
			data-copy
			{...(hidden ? { "aria-hidden": true } : {})}
			className={`flex shrink-0 items-center gap-16 pr-16 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0 ${hidden ? "motion-reduce:hidden" : ""}`}
		>
			{STACK.map((item) => (
				<li key={item.name} className="group flex items-center gap-3">
					<img
						src={`/brand/stack/${item.file}.svg`}
						alt={hidden ? "" : item.name}
						width={item.w}
						height={item.h}
						decoding="async"
						className="opacity-60 brightness-200 grayscale transition duration-300 hover:opacity-100 hover:brightness-100 hover:grayscale-0"
					/>
					{item.word ? (
						<span
							data-word
							aria-hidden="true"
							className="font-display font-medium text-[1.375rem] text-white/60 tracking-[-0.02em] transition-colors duration-300 group-hover:text-white"
						>
							{item.name}
						</span>
					) : null}
				</li>
			))}
		</ul>
	);
}

/**
 * A slow strip of the marks of what Maschina is built with, under the hero: it says where it stands, without a claim. They
 * are plain marks with no links and a label that says "Built with", never "partners". It
 * slides left, stops under the mouse, fades at both edges, and for anyone who asked for less motion it is a still, centered
 * row.
 */
export function Marquee() {
	const m = useMessages().marquee;
	return (
		<section aria-label={m.name} className="bg-black px-(--gutter) pt-4 pb-16 sm:pb-24">
			<p className="mb-8 text-center text-[13px] text-neutral-500">{m.label}</p>
			<div
				data-frame
				className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
			>
				<div
					data-track
					className="flex w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center"
				>
					<Copy />
					<Copy hidden />
				</div>
			</div>
		</section>
	);
}
