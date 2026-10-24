import { ArrowRight } from "@phosphor-icons/react";
import { Link } from "./i18n/link.tsx";

export function SectionLinks({
	name,
	links,
}: {
	name: string;
	links: readonly { label: string; line?: string | undefined; href: string }[];
}) {
	return (
		<nav
			aria-label={name}
			className="relative z-10 h-[4.5rem] w-full border-y border-[oklch(0.94_0.012_245/0.12)] bg-[oklch(0.13_0.003_245)] px-0 md:px-(--gutter) xl:h-[4.25rem]"
		>
			<div className="section-strip-frame grid h-full min-w-0 grid-cols-3 border-x border-[oklch(0.94_0.012_245/0.12)]">
				{links.map(({ label, line, href }) => (
					<Link
						key={href}
						href={href}
						className="group flex min-w-0 items-center justify-center gap-2 md:justify-between border-r border-[oklch(0.94_0.012_245/0.12)] px-2 text-[oklch(0.88_0.009_245)] transition-colors last:border-r-0 hover:bg-[oklch(0.94_0.018_245/0.06)] hover:text-[oklch(0.98_0.012_245)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[oklch(0.94_0.018_245)] md:px-6"
					>
						<span className="min-w-0">
							<span className="block text-center font-display text-[13px] leading-snug md:text-left md:text-[16px]">
								{label}
							</span>
							{line ? (
								<span className="mt-0.5 hidden text-[12px] text-[oklch(0.65_0.008_245)] lg:block">
									{line}
								</span>
							) : null}
						</span>
						<ArrowRight
							aria-hidden="true"
							className="hidden shrink-0 md:block md:size-5 text-[oklch(0.72_0.018_245)] transition-[color,filter] group-hover:text-[oklch(0.99_0.012_245)] group-hover:drop-shadow-[0_0_6px_oklch(0.94_0.025_245/0.55)] group-focus-visible:text-white motion-reduce:transition-none"
						/>
					</Link>
				))}
			</div>
		</nav>
	);
}
