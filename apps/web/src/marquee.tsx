import { useMessages } from "./i18n/use-messages.ts";

/** What Maschina really runs on: the chain, the router and the swap venue, the signing service, the node provider, the host and the database. */
const NAMES = ["Solana", "Jupiter", "Raydium", "Turnkey", "Helius", "Cloudflare", "PostgreSQL"];

/** One copy of the names, as a list. */
function Copy({ hidden }: { hidden?: boolean }) {
	return (
		<ul
			data-copy
			{...(hidden ? { "aria-hidden": true } : {})}
			className={`flex shrink-0 items-center gap-14 pr-14 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0 ${hidden ? "motion-reduce:hidden" : ""}`}
		>
			{NAMES.map((name) => (
				<li
					key={name}
					className="font-display font-medium text-[clamp(1.25rem,2.4vw,1.75rem)] text-neutral-500 tracking-[-0.02em]"
				>
					{name}
				</li>
			))}
		</ul>
	);
}

/**
 * A slow strip of the names of what Maschina is built with, under the hero: it says where it stands, without a claim. They
 * are names in type, with no logos and no links, so nothing here borrows anyone's mark or says they are partners. It
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
