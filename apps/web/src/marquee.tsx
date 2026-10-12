import { useMessages } from "./i18n/use-messages.ts";
import { type Logo, STACK_RUNS_ON, STACK_WRITTEN_WITH } from "./stack.ts";

/** One copy of a row of logos, as a list. The hidden copy is only there to close the loop, so its pictures say nothing. */
function Copy({ logos, hidden }: { logos: Logo[]; hidden?: boolean }) {
	return (
		<ul
			data-copy
			{...(hidden ? { "aria-hidden": true } : {})}
			className={`flex shrink-0 items-center gap-14 pr-14 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0 ${hidden ? "motion-reduce:hidden" : ""}`}
		>
			{logos.map((item) => {
				const size = { width: item.w, height: item.h };
				const alt = hidden ? "" : item.name;
				return (
					<li key={item.name} className="group grid place-items-center">
						{item.gray ? (
							<>
								<img
									data-rest
									src={`/brand/stack/${item.gray}.svg`}
									alt=""
									decoding="async"
									loading="lazy"
									{...size}
									className="col-start-1 row-start-1 opacity-60 transition-opacity duration-300 group-hover:opacity-0"
								/>
								<img
									data-logo
									src={`/brand/stack/${item.file}.svg`}
									alt={alt}
									decoding="async"
									loading="lazy"
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
								loading="lazy"
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

/** One row: it slides, stops under the mouse, fades at both edges, and holds still for anyone who asked for less motion. */
function Row({ logos, reverse }: { logos: Logo[]; reverse?: boolean }) {
	return (
		<div
			data-frame
			className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
		>
			<div
				data-track
				className={`flex w-max hover:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
			>
				<Copy logos={logos} />
				<Copy logos={logos} hidden />
			</div>
		</div>
	);
}

/**
 * Two slow rows of the logos of what Maschina is built with, under the hero: it says where it stands, without a claim.
 * They are the projects' own logos, with no links and a label that says "Built with", never "partners". The first row is
 * the chain and what Maschina runs on; the second, sliding the other way, is what the code is written with.
 */
export function Marquee() {
	const m = useMessages().marquee;
	return (
		<section aria-label={m.name} className="bg-black px-(--gutter) pt-4 pb-16 sm:pb-24">
			<p className="mb-10 text-center text-[13px] text-neutral-500">{m.label}</p>
			<div className="space-y-10 sm:space-y-12">
				<Row logos={STACK_RUNS_ON} />
				<Row logos={STACK_WRITTEN_WITH} reverse />
			</div>
		</section>
	);
}
