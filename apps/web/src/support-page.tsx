import { useId, useState } from "react";
import type { SupportDoc } from "./company/support.ts";
import { Frame } from "./frame.tsx";
import { ArrowChip, PANEL } from "./glass.tsx";
import { HEAD, HeadArt, SHEET } from "./head-art.tsx";
import { Link } from "./i18n/link.tsx";
import { label } from "./i18n/messages.ts";
import { useMessages } from "./i18n/use-messages.ts";
import { titleFor } from "./routes.ts";
import { useTitle } from "./use-title.ts";

const ICON = {
	className: "size-6",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.4,
	strokeLinecap: "square" as const,
	viewBox: "0 0 24 24",
};

/** One small drawing for each topic, in the order the topics are written: start, safety, terms, about. */
const ICONS = [
	<svg aria-hidden="true" key="start" {...ICON}>
		<path d="M4 4h7v16H4zM13 4h7v16h-7zM6.5 8h2M6.5 11h2M15.5 8h2M15.5 11h2" />
	</svg>,
	<svg aria-hidden="true" key="safety" {...ICON}>
		<path d="M12 3 4 6v6c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V6zM9 12l2.2 2.2L15.5 10" />
	</svg>,
	<svg aria-hidden="true" key="terms" {...ICON}>
		<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 15.5h7M9 8.5h3" />
	</svg>,
	<svg aria-hidden="true" key="about" {...ICON}>
		<path d="M4 4h16v16H4zM12 11v6M12 7.5v.5" />
	</svg>,
];

type Topic = SupportDoc["center"]["topics"][number];

/** A page of the site as a help page: its name in the reader's language, and where it is. */
function usePageName() {
	const messages = useMessages();
	return (href: string) => label(messages, titleFor(href) ?? href);
}

/** One row of a list of pages: the name and a small chevron, under a hairline. */
function PageRow({ href, name, topic }: { href: string; name: string; topic?: string }) {
	return (
		<Link
			href={href}
			className="group flex items-center justify-between gap-4 border-white/[0.08] border-t py-3.5 text-[17px] text-neutral-200 transition-colors hover:text-white"
		>
			<span>
				{name}
				{topic ? <span className="ml-3 text-[14px] text-neutral-500">{topic}</span> : null}
			</span>
			<svg
				aria-hidden="true"
				viewBox="0 0 12 12"
				className="size-3 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinecap="square"
			>
				<path d="M4.5 2.5 8 6l-3.5 3.5" />
			</svg>
		</Link>
	);
}

/**
 * The support page, as a help center: a search box over the site's help pages, the topics that sort them, the other ways
 * to get help, and an empty state with a skeleton for the help articles that do not exist yet. Typing narrows the topics
 * to the pages that match, whatever the case, and says plainly when none do.
 */
export function SupportPage({ authUrl, doc }: { authUrl: string; doc: SupportDoc }) {
	useTitle(doc.title);
	const id = useId();
	const name = usePageName();
	const [query, setQuery] = useState("");
	const asked = query.trim().toLowerCase();
	const [write] = doc.ways;

	const results = doc.center.topics.flatMap((topic) =>
		topic.pages
			.map((href) => ({ href, name: name(href), topic: topic.title }))
			.filter(
				(page) =>
					page.name.toLowerCase().includes(asked) || page.topic.toLowerCase().includes(asked),
			),
	);

	return (
		<Frame authUrl={authUrl}>
			<article className="w-full">
				<div data-head className={HEAD}>
					<HeadArt />
					<div data-head-text className="relative mx-auto w-full text-center max-w-[64rem]">
						<h1 className="font-display font-medium text-[clamp(2.5rem,6vw,4.5rem)] text-white leading-[0.98] tracking-[-0.04em]">
							{doc.title}
						</h1>
						<p className="mt-6 text-[clamp(1.125rem,2vw,1.375rem)] text-neutral-200 leading-[1.45]">
							{doc.standfirst}
						</p>
					</div>
				</div>
				<div data-sheet className={`${SHEET} pt-14 pb-24 sm:pt-20 sm:pb-32`}>
					<div data-content className="mx-auto w-full max-w-[64rem]">
						<search className={`flex items-center gap-4 px-5 ${PANEL}`}>
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								className="size-5 shrink-0 text-neutral-400"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								strokeLinecap="square"
							>
								<path d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5" />
							</svg>
							<label htmlFor={`${id}-search`} className="sr-only">
								{doc.center.search}
							</label>
							<input
								id={`${id}-search`}
								type="search"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={doc.center.search}
								autoComplete="off"
								className="h-16 w-full bg-transparent text-[19px] text-white outline-none placeholder:text-neutral-500"
							/>
						</search>

						{asked ? (
							<div data-results className="mt-8">
								{results.length > 0 ? (
									<div className="border-white/[0.08] border-b">
										{results.map((page) => (
											<PageRow
												key={page.href}
												href={page.href}
												name={page.name}
												topic={page.topic}
											/>
										))}
									</div>
								) : (
									<div data-none className="py-10 text-center">
										<p className="mx-auto max-w-[34rem] text-[18px] text-neutral-300 leading-[1.6]">
											{doc.center.none}
										</p>
										{write ? (
											<Link
												href={write.href}
												className="mt-6 inline-flex h-11 items-center gap-4 bg-[oklch(0.93_0.02_300)] pr-1.5 pl-6 text-[15px] text-black transition-colors hover:bg-[oklch(0.98_0.015_300)]"
											>
												<span>{write.title}</span>
												<ArrowChip tone="black" direction="next" />
											</Link>
										) : null}
									</div>
								)}
							</div>
						) : (
							<div data-topics className="mt-8 grid gap-6 md:grid-cols-2">
								{doc.center.topics.map((topic: Topic, index) => (
									<section key={topic.title} data-topic className={`p-7 ${PANEL}`}>
										<span
											aria-hidden="true"
											className="grid size-11 place-items-center bg-white/[0.06] text-neutral-200 outline outline-1 outline-white/[0.12]"
										>
											{ICONS[index] ?? ICONS[0]}
										</span>
										<h2 className="mt-6 font-display font-medium text-[1.5rem] text-white tracking-[-0.025em]">
											{topic.title}
										</h2>
										<p className="mt-2 mb-6 text-[16px] text-neutral-400 leading-[1.55]">
											{topic.body}
										</p>
										{topic.pages.map((href) => (
											<PageRow key={href} href={href} name={name(href)} />
										))}
									</section>
								))}
							</div>
						)}

						<div data-empty className="mx-auto mt-24 w-full max-w-[34rem] text-center">
							<div aria-hidden="true" className="mx-auto mb-8 w-48 space-y-3">
								<div className="h-2 bg-white/[0.08]" />
								<div className="h-2 w-4/5 bg-white/[0.06]" />
								<div className="h-2 w-3/5 bg-white/[0.04]" />
							</div>
							<h2 className="font-display font-medium text-[1.5rem] text-white leading-tight tracking-[-0.025em]">
								{doc.articles.heading}
							</h2>
							<p className="mt-4 text-[17px] text-neutral-400 leading-[1.6]">{doc.articles.body}</p>
						</div>

						<h2 className="mt-24 font-display font-medium text-[clamp(1.5rem,2.6vw,2rem)] text-white tracking-[-0.03em]">
							{doc.center.moreWays}
						</h2>
						<div className="mt-6 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{doc.ways.map((way) => (
								<Link
									key={way.href}
									data-way
									href={way.href}
									className={`group relative block h-full min-h-44 p-6 pb-16 transition-colors hover:bg-white/[0.06] ${PANEL}`}
								>
									<span className="block font-display font-medium text-[1.25rem] text-white tracking-[-0.02em]">
										{way.title}
									</span>
									<span className="mt-3 block text-[15px] text-neutral-400 leading-[1.55]">
										{way.body}
									</span>
									<ArrowChip className="absolute right-5 bottom-5" />
								</Link>
							))}
						</div>
					</div>
				</div>
			</article>
		</Frame>
	);
}
