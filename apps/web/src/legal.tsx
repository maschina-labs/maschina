import { useEffect, useState } from "react";
import { Frame } from "./frame.tsx";
import { centerInView, scrolled, scroller } from "./shell.ts";
import { useTitle } from "./use-title.ts";

/** A bit of running text: plain words, or words with a link in them. */
type Part = string | { text: string; href: string };
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

const flat = (parts: Part[]) =>
	parts.map((part) => (typeof part === "string" ? part : part.text)).join("");

function Text({ parts }: { parts: Part[] }) {
	return parts.map((part, index) =>
		typeof part === "string" ? (
			<span key={`${index}-${part}`}>{part}</span>
		) : (
			<a key={part.href} href={part.href} className={LINK}>
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
	useEffect(() => {
		if (typeof IntersectionObserver === "undefined") return;
		const watcher = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((entry) => entry.isIntersecting);
				const first = visible.sort(
					(a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
				)[0];
				if (first) setCurrent(first.target.getAttribute("data-section"));
			},
			{ rootMargin: "-30% 0px -60% 0px" },
		);
		for (const id of ids) {
			const node = document.querySelector(`[data-section="${id}"]`);
			if (node) watcher.observe(node);
		}
		return () => watcher.disconnect();
	}, [ids]);
	return current;
}

function Contents({
	doc,
	current,
	className,
}: {
	doc: LegalDoc;
	current: string | null;
	className: string;
}) {
	return (
		<ol className={className}>
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
 * A legal document, set the way a contract is and the way the best product legal pages are: a small label, a big plain
 * title, the date, and the first words as a lead; then a hairline, the contents down the left (held in view, with the
 * section you are in lit) and the text in a reading column on the right. Every section is numbered and every clause inside it (1.1, 1.2) has its own number as an address, and a counter
 * pinned at the left shows the clause being read, rolling up to the next like an odometer as the reading goes on. Seventeen pixel type with roomy lines, headings that step up with
 * room above them, square bullets, and nothing else. On a phone it is just text on a page: no contents, no counter, no numbers in the margin, no indent, and the type a size up. The page
 * margins are the article's own padding and the width is on a box inside it, so the margins never squeeze the text.
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
					<div className="max-w-[48rem]">
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
					<div data-layout className="mt-20 grid gap-x-16 lg:grid-cols-[minmax(0,1fr)_12rem]">
						<div data-text className="max-w-[50rem]">
							{doc.sections.map((section, sectionIndex) => {
								const id = slug(section.heading);
								let clause = 0;
								return (
									<section key={id} data-section={id} className="scroll-mt-28 pt-14 first:pt-0">
										<div className="sticky top-28 z-10 h-0 max-md:hidden">
											<span
												data-counter
												aria-hidden="true"
												className="block w-14 bg-black font-normal text-[1.25rem] text-neutral-200 leading-[1.25em] tabular-nums"
											>
												{sectionIndex + 1}
												<span data-dot className="text-neutral-500">
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
											className="pl-16 font-display font-medium text-[1.75rem] text-white leading-tight tracking-[-0.025em] outline-none max-md:pl-0 max-md:text-[1.5rem]"
										>
											{section.heading}
										</h2>
										{section.body.map((block) => {
											if (!Array.isArray(block) && typeof block === "object") {
												return (
													<ul
														key={block.list.join("|")}
														className="mt-4 ml-32 list-[square] space-y-2 pl-5 marker:text-neutral-600 max-md:ml-0"
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
													className="mt-5 ml-16 grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 max-md:ml-0 max-md:block"
												>
													<span
														data-clause-number
														aria-hidden="true"
														className="pt-[0.45em] text-[13px] text-neutral-600 tabular-nums max-md:hidden"
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
						<div className="hidden lg:block">
							<nav
								aria-label="On this page"
								className="hidden text-[13px] lg:sticky lg:top-28 lg:block lg:max-h-[calc(100svh-9rem)] lg:overflow-y-auto"
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
