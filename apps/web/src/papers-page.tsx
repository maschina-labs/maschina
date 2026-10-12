import type { PapersDoc } from "./company/papers.ts";
import { Frame } from "./frame.tsx";
import { HEAD, HeadArt, SHEET } from "./head-art.tsx";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { useTitle } from "./use-title.ts";

const CARD = "block h-full p-6";

/**
 * The papers page: the held mesh head, then on the black sheet a group of equal cards for each kind of thing: videos,
 * decks and papers. A card with an address is a link that leaves the site and shows an arrow. One without says Coming
 * soon and is not a link, so nothing here is dead.
 */
export function PapersPage({ authUrl, doc }: { authUrl: string; doc: PapersDoc }) {
	const m = useMessages().papers;
	useTitle(doc.title);
	return (
		<Frame authUrl={authUrl}>
			<article className="w-full">
				<div data-head className={HEAD}>
					<HeadArt />
					<div data-head-text className="relative mx-auto w-full text-center max-w-[64rem]">
						<h1 className="font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
							{doc.title}
						</h1>
						<p className="mx-auto mt-6 max-w-[40rem] text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45]">
							{doc.standfirst}
						</p>
					</div>
				</div>
				<div data-sheet className={`${SHEET} pt-14 pb-24 sm:pt-20 sm:pb-32`}>
					<div className="mx-auto w-full max-w-[64rem] space-y-16">
						{doc.groups.map((group) => (
							<section key={group.heading}>
								<h2 className="font-display font-medium text-[1.75rem] text-white leading-tight tracking-[-0.025em]">
									{group.heading}
								</h2>
								<div
									data-group={group.id}
									className={`mt-6 grid auto-rows-fr gap-3 sm:grid-cols-2 ${group.compact ? "lg:grid-cols-3" : ""}`}
								>
									{group.items.map((item) => {
										const inside = (
											<>
												{item.number ? (
													<span
														data-number
														className="mb-3 block text-[13px] text-neutral-500 tabular-nums"
													>
														{item.number}
													</span>
												) : null}
												<span
													data-name
													className="flex items-center justify-between gap-4 font-display font-medium text-[1.25rem] text-white tracking-[-0.015em]"
												>
													{item.name}
													{item.href ? (
														<svg
															data-icon="arrow"
															viewBox="0 0 12 12"
															className="size-3 shrink-0"
															fill="none"
															stroke="currentColor"
															strokeWidth={1.5}
															strokeLinecap="square"
															aria-hidden="true"
														>
															<path d="M3 9 9 3M4 3h5v5" />
														</svg>
													) : null}
												</span>
												{item.body ? (
													<span className="mt-3 block text-[16px] text-neutral-400 leading-[1.55]">
														{item.body}
													</span>
												) : null}
												{item.href ? null : (
													<span className="mt-5 inline-block text-[13px] text-neutral-500">
														{m.soon}
													</span>
												)}
											</>
										);
										return item.href ? (
											<Link
												key={item.name}
												data-item
												href={item.href}
												target="_blank"
												rel="noopener noreferrer"
												className={`${CARD} ${group.compact ? "min-h-36" : "min-h-44"} bg-white/[0.06] transition-colors hover:bg-white/[0.1]`}
											>
												{inside}
											</Link>
										) : (
											<div
												key={item.name}
												data-item
												className={`${CARD} ${group.compact ? "min-h-36" : "min-h-44"} bg-white/[0.04]`}
											>
												{inside}
											</div>
										);
									})}
								</div>
							</section>
						))}
					</div>
				</div>
			</article>
		</Frame>
	);
}
