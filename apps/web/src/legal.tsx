import { useEffect, useRef, useState } from "react";
import { Frame } from "./frame.tsx";
import { centerInView, scrolled, scroller } from "./shell.ts";
import { useTitle } from "./use-title.ts";

/** A bit of running text: plain words, or words with a link in them. */
export type Part = string | { text: string; href: string };
/** One block of a section: a clause (plain, or with links in it) or a bulleted list that belongs to the clause before it. */
type Block = string | Part[] | { list: string[] };

export type LegalDoc = {
	title: string;
	/** The date it was last changed, as it is shown: "October 9, 2026". */
	updated: string;
	intro?: (string | Part[])[];
	sections: { heading: string; body: Block[] }[];
};

const slug = (heading: string) =>
	heading
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const CLAUSE = "text-[17px] text-neutral-300 leading-[1.7] max-md:text-[18px]";
const LINK =
	"text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white";

export const flat = (parts: Part[]) =>
	parts.map((part) => (typeof part === "string" ? part : part.text)).join("");

export function Text({ parts }: { parts: Part[] }) {
	return parts.map((part, index) =>
		typeof part === "string" ? (
			<span key={`${index}-${part}`}>{part}</span>
		) : (
			<a
				key={part.href}
				href={part.href}
				// A link that leaves the site opens in a new tab and does not hand the new page this one.
				{...(part.href.startsWith("https://")
					? { target: "_blank", rel: "noopener noreferrer" }
					: {})}
				className={LINK}
			>
				{part.text}
			</a>
		),
	);
}

/**
 * A click on the contents goes to the section by the page's own scrolling instead of the browser's jump to an address,
 * so the section lands in the middle of the screen and stays there. The address still follows, and the keyboard moves
 * to the section's heading.
 */
function jump(event: React.MouseEvent, id: string) {
	const heading = document.getElementById(id);
	const section = heading?.closest("section");
	if (!heading || !section) return;
	event.preventDefault();
	centerInView(section);
	window.history.replaceState(null, "", `#${id}`);
	heading.focus({ preventScroll: true });
}

/** How far down the screen the counter sits: just under the header. A clause counts as being read once it reaches here. */
const LINE = 140;

/**
 * Which clause of each section is being read: the last one whose top has reached the line under the header, or the first
 * if none has. It is worked out on every scroll, for every section, so a section above holds its last clause and one
 * below holds its first. Nothing is measured on arrival at the top of the page, where every section is at its first.
 */
function useClauseCounters(sections: number) {
	const [counts, setCounts] = useState<number[]>(() => Array.from({ length: sections }, () => 1));
	useEffect(() => {
		const target = scroller();
		const measure = () => {
			const next = Array.from(document.querySelectorAll("[data-section]")).map((section) => {
				const clauses = [...section.querySelectorAll("[data-clause-id]")];
				let count = 1;
				for (const [index, clause] of clauses.entries())
					if (clause.getBoundingClientRect().top <= LINE) count = index + 1;
				return count;
			});
			setCounts((now) =>
				next.length === now.length && next.every((n, i) => n === now[i]) ? now : next,
			);
		};
		// Coming back to a page that has already been scrolled (a reload or a link with an address), so start from where it is.
		if (scrolled(target) > 0) measure();
		target.addEventListener("scroll", measure, { passive: true });
		window.addEventListener("resize", measure);
		return () => {
			target.removeEventListener("scroll", measure);
			window.removeEventListener("resize", measure);
		};
	}, []);
	return counts;
}

/** The section on screen, so the contents can show where the reader is. Where nothing can be watched, none. */
function useCurrentSection(ids: string[]) {
	const [current, setCurrent] = useState<string | null>(null);
	const key = ids.join("|");
	useEffect(() => {
		const sections = key.split("|");
		// The section being read is the last one whose top has reached the middle of the screen. Watching a thin band
		// with an observer misses a short last section, which never reaches the band before the page ends.
		const measure = () => {
			const middle = window.innerHeight / 2;
			let found: string | null = null;
			for (const id of sections) {
				const node = document.querySelector(`[data-section="${id}"]`);
				if (node && node.getBoundingClientRect().top <= middle) found = id;
			}
			// At the very end of the page a short last section may never reach the middle, so it is the one being read.
			const end = document.documentElement.scrollHeight - 2;
			if (window.scrollY + window.innerHeight >= end)
				found = sections[sections.length - 1] ?? found;
			setCurrent(found);
		};
		const root = scroller();
		measure();
		root.addEventListener("scroll", measure, { passive: true });
		window.addEventListener("resize", measure);
		return () => {
			root.removeEventListener("scroll", measure);
			window.removeEventListener("resize", measure);
		};
	}, [key]);
	return current;
}

export function Contents({
	doc,
	current,
	className,
}: {
	doc: LegalDoc;
	current: string | null;
	className: string;
}) {
	const list = useRef<HTMLOListElement>(null);
	// The list is taller than the screen on a long document, so it scrolls on its own. Keep the lit line inside it by
	// moving the list only, never the page: scrollIntoView would drag the page along.
	useEffect(() => {
		const box = list.current?.closest("nav");
		const lit = list.current?.querySelector('[aria-current="location"]');
		if (!box || !lit) return;
		const frame = box.getBoundingClientRect();
		const line = lit.getBoundingClientRect();
		if (line.top >= frame.top && line.bottom <= frame.bottom) return;
		box.scrollTop = line.top - frame.top + box.scrollTop - (frame.height - line.height) / 2;
	}, [current]);
	return (
		<ol ref={list} className={className}>
			{doc.sections.map((section, index) => {
				const id = slug(section.heading);
				return (
					<li key={id}>
						<a
							href={`#${id}`}
							onClick={(event) => jump(event, id)}
							aria-current={current === id ? "location" : undefined}
							className={`flex gap-3 py-1.5 transition-colors ${current === id ? "text-white" : "text-neutral-500 hover:text-neutral-200"}`}
						>
							<span className="w-5 shrink-0 text-neutral-600 tabular-nums">{index + 1}</span>
							{section.heading}
						</a>
					</li>
				);
			})}
		</ol>
	);
}

/**
 * The legal page with its text centered: one reading column in the middle of the page, the title at the column's left
 * edge, every line of text on that one edge with no stepping in and out, and the numbers kept but moved out of the way.
 * The clause numbers hang in the margin beside each clause, small and faint, and the counter that follows the reading
 * sits further out in the margin, small, rolling like an odometer. The contents are down the right of a very wide
 * screen. Below a wide screen the numbers go, and on a phone it is just text on a page.
 */
export function LegalPage({ authUrl, doc }: { authUrl: string; doc: LegalDoc }) {
	useTitle(doc.title);
	const ids = doc.sections.map((section) => slug(section.heading));
	const current = useCurrentSection(ids);
	const counts = useClauseCounters(doc.sections.length);
	const clauseTotals = doc.sections.map(
		(section) =>
			section.body.filter((block) => typeof block === "string" || Array.isArray(block)).length,
	);
	return (
		<Frame authUrl={authUrl}>
			<article className="w-full px-(--gutter) pt-36 pb-28 sm:pt-44 sm:pb-40">
				<div data-column className="w-full">
					<div data-head className="mx-auto w-full max-w-[44rem]">
						<p className="text-[14px] text-neutral-500">Legal</p>
						<h1 className="mt-5 font-display font-medium text-[clamp(2.75rem,7vw,5.5rem)] text-white leading-[0.98] tracking-[-0.04em] [text-wrap:balance]">
							{doc.title}
						</h1>
						<p className="mt-6 text-[14px] text-neutral-500">Last updated {doc.updated}</p>
						{doc.intro?.map((block) => (
							<p
								key={typeof block === "string" ? block : flat(block)}
								className="mt-8 text-[19px] text-neutral-300 leading-[1.6]"
							>
								{typeof block === "string" ? block : <Text parts={block} />}
							</p>
						))}
					</div>
					<div
						data-layout
						className="mt-20 grid gap-x-12 xl:grid-cols-[minmax(0,1fr)_44rem_minmax(0,1fr)]"
					>
						<div className="hidden xl:block" />
						<div data-text className="mx-auto w-full max-w-[44rem]">
							{doc.sections.map((section, sectionIndex) => {
								const id = slug(section.heading);
								let clause = 0;
								return (
									<section key={id} data-section={id} className="scroll-mt-28 pt-14 first:pt-0">
										<div className="sticky top-28 z-10 h-0 max-lg:hidden">
											<span
												data-counter
												aria-hidden="true"
												className="-ml-36 block w-14 text-right font-normal text-[14px] text-neutral-300 leading-[1.25em] tabular-nums"
											>
												{sectionIndex + 1}
												<span data-dot className="text-neutral-600">
													.
												</span>
												<span
													data-odometer
													data-value={counts[sectionIndex] ?? 1}
													className="inline-block h-[1.25em] overflow-hidden align-bottom"
												>
													<span
														className="flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
														style={{
															transform: `translateY(${-((counts[sectionIndex] ?? 1) - 1) * 1.25}em)`,
														}}
													>
														{Array.from(
															{ length: clauseTotals[sectionIndex] ?? 1 },
															(_, number) => (
																<span
																	key={`${sectionIndex}.${number + 1}`}
																	className="block h-[1.25em] text-neutral-500 leading-[1.25em]"
																>
																	{number + 1}
																</span>
															),
														)}
													</span>
												</span>
											</span>
										</div>
										<h2
											id={id}
											tabIndex={-1}
											className="font-display font-medium text-[1.75rem] text-white leading-tight tracking-[-0.025em] outline-none max-md:text-[1.5rem]"
										>
											{section.heading}
										</h2>
										{section.body.map((block) => {
											if (!Array.isArray(block) && typeof block === "object") {
												return (
													<ul
														key={block.list.join("|")}
														className="mt-4 list-[square] space-y-2 pl-5 marker:text-neutral-600"
													>
														{block.list.map((item) => (
															<li key={item} className={`${CLAUSE} pl-1`}>
																{item}
															</li>
														))}
													</ul>
												);
											}
											clause += 1;
											return (
												<div
													key={typeof block === "string" ? block : flat(block)}
													data-clause-id={`${sectionIndex + 1}.${clause}`}
													className="relative mt-5"
												>
													<span
														data-clause-number
														aria-hidden="true"
														className="absolute top-[0.5em] -left-14 w-10 text-right text-[12px] text-neutral-700 tabular-nums max-lg:hidden"
													>
														{sectionIndex + 1}.{clause}
													</span>
													<p className={CLAUSE}>
														{typeof block === "string" ? block : <Text parts={block} />}
													</p>
												</div>
											);
										})}
									</section>
								);
							})}
						</div>
						<div className="hidden xl:block">
							<nav
								aria-label="On this page"
								className="hidden text-[13px] xl:sticky xl:top-28 xl:block xl:max-h-[calc(100svh-9rem)] xl:overflow-y-auto"
							>
								<Contents doc={doc} current={current} className="flex flex-col" />
							</nav>
						</div>
					</div>
				</div>
			</article>
		</Frame>
	);
}
