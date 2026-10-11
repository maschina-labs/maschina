import { ArrowUpRight } from "@phosphor-icons/react";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	ago,
	type NewsFilter,
	type NewsItem,
	picked,
	sourcesOf,
	storyKey,
	useNews,
} from "../lib/news.ts";

/**
 * The news, under Home: scrolled down to, never mixed in with your own tiles above it. The world's
 * stories here, your money up there.
 *
 * A rail of sources on the left, the newest story large, then the rest as rows with their picture at
 * the side. A story opens here, over Home; going on to its publisher is a choice of its own.
 */

function Byline({ item }: { item: NewsItem }) {
	return (
		<span className="flex items-center gap-1.5 text-[12px] text-neutral-500">
			<span data-source className="text-neutral-300">
				{item.source}
			</span>
			·<span>{ago(item.publishedAt)}</span>
		</span>
	);
}

function Story({ item, lead }: { item: NewsItem; lead: boolean }) {
	return (
		<article
			data-lead={lead}
			className="bg-white/[0.06] backdrop-blur-xl transition-colors hover:bg-white/[0.1]"
		>
			<Link
				to="/news/$storyId"
				params={{ storyId: storyKey(item.id) }}
				className={lead ? "flex flex-col gap-4 p-4" : "flex items-start gap-4 p-4"}
			>
				{lead && item.image ? (
					<img
						src={item.image}
						alt=""
						loading="lazy"
						referrerPolicy="no-referrer"
						className="aspect-[2/1] w-full bg-white/[0.04] object-cover"
					/>
				) : null}
				<span className="flex min-w-0 flex-1 flex-col gap-2">
					<Byline item={item} />
					<span
						className={
							lead
								? "font-display text-[22px] text-neutral-100 leading-snug"
								: "text-[15px] text-neutral-100 leading-snug"
						}
					>
						{item.title}
					</span>
					{item.summary ? (
						<span
							className={`text-[13px] text-neutral-400 leading-relaxed ${lead ? "line-clamp-3" : "line-clamp-2"}`}
						>
							{item.summary}
						</span>
					) : null}
				</span>
				{!lead && item.image ? (
					<img
						src={item.image}
						alt=""
						loading="lazy"
						referrerPolicy="no-referrer"
						className="aspect-[16/10] w-32 shrink-0 bg-white/[0.04] object-cover"
					/>
				) : null}
			</Link>
		</article>
	);
}

function RailButton({
	label,
	name,
	chosen,
	onClick,
}: {
	label: string;
	name?: string;
	chosen: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={name}
			aria-pressed={chosen}
			onClick={onClick}
			className={`px-3 py-2 text-left text-[14px] transition-colors ${chosen ? "bg-white text-neutral-950" : "text-neutral-300 hover:bg-white/[0.08]"}`}
		>
			{label}
		</button>
	);
}

export function NewsFeed() {
	const { api } = useRouter().options.context;
	const news = useNews(api);
	const [filter, setFilter] = useState<NewsFilter>({ kind: "all" });
	const items = news.data?.items ?? [];
	const shown = picked(items, filter);
	const is = (kind: NewsFilter["kind"], source?: string) =>
		filter.kind === kind && (filter.kind !== "source" || filter.source === source);

	return (
		<div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-[10px]">
			<nav
				aria-label="News sources"
				className="flex gap-1 overflow-x-auto bg-white/[0.06] p-2 backdrop-blur-xl md:sticky md:top-4 md:w-[calc(var(--u)*1.5)] md:shrink-0 md:flex-col md:overflow-visible"
			>
				<RailButton
					label="All"
					name="All news"
					chosen={is("all")}
					onClick={() => setFilter({ kind: "all" })}
				/>
				<RailButton
					label="Solana"
					name="Solana only"
					chosen={is("solana")}
					onClick={() => setFilter({ kind: "solana" })}
				/>
				<span className="hidden px-3 pt-4 pb-1 text-[12px] text-neutral-500 md:block">Sources</span>
				{sourcesOf(items).map((source) => (
					<RailButton
						key={source}
						label={source}
						chosen={is("source", source)}
						onClick={() => setFilter({ kind: "source", source })}
					/>
				))}
			</nav>
			<section
				aria-label="News"
				role="feed"
				aria-busy={news.isPending}
				className="flex min-w-0 flex-1 flex-col gap-[10px]"
			>
				{news.isPending ? (
					<p className="p-4 text-[13px] text-neutral-500">Reading the news…</p>
				) : shown.length === 0 ? (
					<p className="p-4 text-[13px] text-neutral-500">
						{news.isError ? "The news could not be read just now." : "No stories here yet."}
					</p>
				) : (
					shown.map((item, index) => <Story key={item.id} item={item} lead={index === 0} />)
				)}
			</section>
		</div>
	);
}

/** One story, read in the app: what the publisher's feed gives, and a plain way on to the whole of it. */
export function NewsReader({ storyKey: key }: { storyKey: string }) {
	const { api } = useRouter().options.context;
	const news = useNews(api);
	const item = news.data?.items.find((each) => storyKey(each.id) === key);
	if (!item)
		return (
			<p className="bg-white/[0.06] p-6 text-[14px] text-neutral-400">
				{news.isPending
					? "Reading the news…"
					: "This story is no longer in the news. The feed keeps only the latest from each publisher."}
			</p>
		);
	return (
		<article className="flex flex-col gap-6 bg-white/[0.06] p-6 backdrop-blur-xl md:flex-row md:gap-8 md:p-8">
			{item.image ? (
				<img
					src={item.image}
					alt=""
					referrerPolicy="no-referrer"
					className="aspect-[16/10] w-full bg-white/[0.04] object-cover md:w-[45%] md:shrink-0"
				/>
			) : null}
			<div className="flex min-w-0 flex-1 flex-col gap-4">
				<Byline item={item} />
				<h2 className="font-display font-normal text-[clamp(24px,2.4vw,34px)] text-neutral-100 leading-tight">
					{item.title}
				</h2>
				{item.summary ? (
					<p className="text-[15px] text-neutral-300 leading-relaxed">{item.summary}</p>
				) : null}
				<a
					href={item.link}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-2 inline-flex items-center gap-2 self-start bg-white px-4 py-2.5 text-[14px] text-neutral-950 transition-colors hover:bg-white/90"
				>
					Read it on {item.source}
					<ArrowUpRight size={16} weight="bold" />
				</a>
			</div>
		</article>
	);
}
