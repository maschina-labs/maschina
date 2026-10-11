import type { SupportDoc } from "./company/support.ts";
import { Frame } from "./frame.tsx";
import { HEAD, HeadArt, SHEET } from "./head-art.tsx";
import { Link } from "./i18n/link.tsx";
import { useTitle } from "./use-title.ts";

/**
 * The support page: the held mesh head, then on the black sheet a grid of cards, one for each way to get help, and an
 * empty state for the help articles that do not exist yet.
 */
export function SupportPage({ authUrl, doc }: { authUrl: string; doc: SupportDoc }) {
	useTitle(doc.title);
	return (
		<Frame authUrl={authUrl}>
			<article className="w-full">
				<div data-head className={HEAD}>
					<HeadArt />
					<div data-head-text className="relative mx-auto w-full max-w-[64rem]">
						<p className="text-[14px] text-neutral-400">{doc.kicker}</p>
						<h1 className="mt-5 font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
							{doc.title}
						</h1>
						<p className="mt-6 text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45]">
							{doc.standfirst}
						</p>
					</div>
				</div>
				<div data-sheet className={`${SHEET} pt-14 pb-24 sm:pt-20 sm:pb-32`}>
					<div
						data-content
						className="mx-auto grid w-full max-w-[64rem] auto-rows-fr gap-3 sm:grid-cols-2"
					>
						{doc.ways.map((way) => (
							<Link
								key={way.href}
								href={way.href}
								className="group block h-full min-h-44 bg-white/[0.06] p-6 transition-colors hover:bg-white/[0.1]"
							>
								<span className="block font-display font-medium text-[1.25rem] text-white tracking-[-0.015em]">
									{way.title}
								</span>
								<span className="mt-3 block text-[16px] text-neutral-400 leading-[1.55]">
									{way.body}
								</span>
							</Link>
						))}
					</div>
					<div data-empty className="mx-auto mt-24 w-full max-w-[34rem] text-center">
						<h2 className="font-display font-medium text-[1.5rem] text-white leading-tight tracking-[-0.025em]">
							{doc.articles.heading}
						</h2>
						<p className="mt-4 text-[17px] text-neutral-400 leading-[1.6]">{doc.articles.body}</p>
					</div>
				</div>
			</article>
		</Frame>
	);
}
