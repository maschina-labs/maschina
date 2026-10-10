import { lazy, Suspense, useEffect, useState } from "react";
import { Frame } from "./frame.tsx";
import { flat, type Part, Text } from "./legal.tsx";
import { useTitle } from "./use-title.ts";

/** One block of a section: a paragraph (plain, or with links in it), a pulled quote, or a bulleted list. */
type Block = string | Part[] | { quote: string } | { list: string[] };

export type ArticleDoc = {
	/** The small label above the headline, such as the part of the site it belongs to. */
	kicker: string;
	title: string;
	/** The one or two sentences under the headline that say what the piece is. */
	standfirst: string;
	byline: string;
	/** The date as it is shown: "October 9, 2026". */
	date: string;
	sections: { heading?: string; body: Block[] }[];
};

// The mesh field, from the same package as the front page's ribbon, loaded after the page is on screen so the page never waits for it.
const Field = lazy(() =>
	import("@maschina/field").then((module) => ({ default: module.FogBackground })),
);

const BODY = "text-[20px] text-neutral-300 leading-[1.7] max-md:text-[19px] [text-wrap:pretty]";

/**
 * A page that reads like a newsletter or a news article, for the company pages: a small label, a big headline, a standfirst, who wrote it and when, then one column of larger type in the middle of the page, on the same left edge as the head's text with
 * plain headings, pulled quotes and lists. It has none of the legal pages' numbers, counter or contents: it is read
 * once, top to bottom. The page margins are the article's own padding, so they never squeeze the column.
 */
export function ArticlePage({ authUrl, doc }: { authUrl: string; doc: ArticleDoc }) {
	useTitle(doc.title);
	const [ready, setReady] = useState(false);
	useEffect(() => setReady(true), []);
	return (
		<Frame authUrl={authUrl}>
			<article className="w-full">
				<header
					data-head
					className="sticky top-0 flex h-[50lvh] min-h-[28rem] flex-col justify-end overflow-hidden px-(--gutter) pt-24 pb-12 sm:pb-16"
				>
					<div data-art aria-hidden="true" className="pointer-events-none absolute inset-0">
						{ready ? (
							<Suspense fallback={null}>
								<div className="absolute inset-0 animate-fade-in motion-reduce:animate-none">
									<Field position="absolute" field="mesh" motion="full" mode="dark" />
								</div>
							</Suspense>
						) : null}
						<div className="absolute inset-0 bg-[oklch(0_0_0/0.15)]" />
					</div>
					<div data-head-text className="relative mx-auto w-full max-w-[48rem]">
						<p className="text-[14px] text-neutral-400">{doc.kicker}</p>
						<h1 className="mt-5 font-display font-medium text-[clamp(2.25rem,5vw,3.75rem)] text-white leading-[1] tracking-[-0.04em] [text-wrap:balance]">
							{doc.title}
						</h1>
						<p className="mt-6 text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45] [text-wrap:balance]">
							{doc.standfirst}
						</p>
						<p className="mt-6 text-[14px] text-neutral-400">
							By {doc.byline}
							<span aria-hidden="true"> · </span>
							<time>{doc.date}</time>
						</p>
					</div>
				</header>
				<div
					data-sheet
					className="relative z-10 bg-black px-(--gutter) pt-14 pb-24 sm:pt-20 sm:pb-32"
				>
					<div data-body className="mx-auto w-full max-w-[48rem]">
						{doc.sections.map((section, sectionIndex) => (
							<section
								// A section may have no heading, so its place in the article is its key.
								key={sectionIndex}
								className="mt-12 first:mt-0"
							>
								{section.heading ? (
									<h2 className="font-display font-medium text-[1.75rem] text-white leading-tight tracking-[-0.025em] max-md:text-[1.5rem]">
										{section.heading}
									</h2>
								) : null}
								{section.body.map((block) => {
									if (!Array.isArray(block) && typeof block === "object") {
										if ("quote" in block)
											return (
												<blockquote
													key={block.quote}
													className="my-10 font-display font-normal text-[clamp(1.5rem,3vw,2.125rem)] text-neutral-400 leading-[1.3] tracking-[-0.02em] [text-wrap:balance]"
												>
													{block.quote}
												</blockquote>
											);
										return (
											<ul
												key={block.list.join("|")}
												className="mt-5 list-[square] space-y-3 pl-6 marker:text-neutral-600"
											>
												{block.list.map((item) => (
													<li key={item} className={`${BODY} pl-1`}>
														{item}
													</li>
												))}
											</ul>
										);
									}
									return (
										<p
											key={typeof block === "string" ? block : flat(block)}
											className={`mt-6 ${BODY}`}
										>
											{typeof block === "string" ? block : <Text parts={block} />}
										</p>
									);
								})}
							</section>
						))}
					</div>
				</div>
			</article>
		</Frame>
	);
}
