import { useMessages } from "./i18n/use-messages.ts";

/**
 * What Maschina really runs on: the chain, the swap router, the signing service, the node provider, the host and the
 * database. Each is the company's own published logo file, unmodified, whole: the mark with its wordmark where the company
 * has one. `w` and `h` are the size it is shown at, in pixels. Jupiter publishes a grayscale logo of its own, so that is its
 * resting state (`gray`); the others are shown gray by a filter and in their own colors on hover. PostgreSQL's logo is the
 * elephant alone.
 */
const STACK = [
	{ name: "Solana", file: "solana", w: 175, h: 26 },
	{ name: "Jupiter", file: "jupiter", gray: "jupiter-gray", w: 85, h: 26 },
	{ name: "Turnkey", file: "turnkey", w: 100, h: 26 },
	{ name: "Helius", file: "helius", w: 133, h: 28 },
	{ name: "Cloudflare", file: "cloudflare", w: 97, h: 36 },
	{ name: "PostgreSQL", file: "postgresql", w: 38, h: 40 },
];

/** One copy of the logos, as a list. The hidden copy is only there to close the loop, so its pictures say nothing. */
function Copy({ hidden }: { hidden?: boolean }) {
	return (
		<ul
			data-copy
			{...(hidden ? { "aria-hidden": true } : {})}
			className={`flex shrink-0 items-center gap-16 pr-16 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0 ${hidden ? "motion-reduce:hidden" : ""}`}
		>
			{STACK.map((item) => {
				const size = { width: item.w, height: item.h };
				const alt = hidden ? "" : item.name;
				return (
					<li key={item.name} className="group grid place-items-center">
						{"gray" in item ? (
							<>
								<img
									data-rest
									src={`/brand/stack/${item.gray}.svg`}
									alt=""
									decoding="async"
									{...size}
									className="col-start-1 row-start-1 opacity-60 transition-opacity duration-300 group-hover:opacity-0"
								/>
								<img
									data-logo
									src={`/brand/stack/${item.file}.svg`}
									alt={alt}
									decoding="async"
									{...size}
									className="col-start-1 row-start-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
								/>
							</>
						) : (
							<img
								data-logo
								src={`/brand/stack/${item.file}.svg`}
								alt={alt}
								decoding="async"
								{...size}
								className="opacity-60 brightness-200 grayscale transition duration-300 group-hover:opacity-100 group-hover:brightness-100 group-hover:grayscale-0"
							/>
						)}
					</li>
				);
			})}
		</ul>
	);
}

/**
 * A slow strip of the logos of what Maschina is built with, under the hero: it says where it stands, without a claim. They
 * are the companies' own logos with no links and a label that says "Built with", never "partners". It slides left, stops
 * under the mouse, fades at both edges, and for anyone who asked for less motion it is a still, centered row.
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
