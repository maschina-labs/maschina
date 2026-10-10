import type { EmptyDoc } from "./company/empty.ts";
import { Frame } from "./frame.tsx";
import { HEAD, HeadArt, SHEET } from "./head-art.tsx";
import { useTitle } from "./use-title.ts";

/**
 * A company page with nothing on it yet: the held mesh head, then a black sheet with one empty state in the middle,
 * which says plainly that there is nothing, and where to look in the meantime. It is a page in its own right, so a
 * visitor is never sent to a blank screen.
 */
export function EmptyPage({ authUrl, doc }: { authUrl: string; doc: EmptyDoc }) {
	useTitle(doc.title);
	return (
		<Frame authUrl={authUrl}>
			<article className="w-full">
				<div data-head className={HEAD}>
					<HeadArt />
					<div data-head-text className="relative mx-auto w-full max-w-[44rem]">
						<p className="text-[14px] text-neutral-400">{doc.kicker}</p>
						<h1 className="mt-5 font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
							{doc.title}
						</h1>
						<p className="mt-6 text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45]">
							{doc.standfirst}
						</p>
					</div>
				</div>
				<div data-sheet className={`${SHEET} min-h-[50lvh] py-24 sm:py-32`}>
					<div data-empty className="mx-auto w-full max-w-[34rem] text-center">
						<h2 className="font-display font-medium text-[1.75rem] text-white leading-tight tracking-[-0.025em]">
							{doc.heading}
						</h2>
						<p className="mt-5 text-[19px] text-neutral-400 leading-[1.6]">{doc.body}</p>
						<div className="mt-10 flex flex-wrap justify-center gap-3">
							{doc.links.map((link) => (
								<a
									key={link.href}
									href={link.href}
									{...(link.href.startsWith("https://")
										? { target: "_blank", rel: "noopener noreferrer" }
										: {})}
									className="inline-flex h-10 items-center bg-white/[0.08] px-5 text-[15px] text-neutral-200 transition-colors hover:bg-white/[0.14] hover:text-white"
								>
									{link.label}
								</a>
							))}
						</div>
					</div>
				</div>
			</article>
		</Frame>
	);
}
