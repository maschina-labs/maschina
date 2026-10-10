import { Frame } from "./frame.tsx";
import { useTitle } from "./use-title.ts";

/** A bit of running text: plain words, or words with a link in them. */
type Part = string | { text: string; href: string };
/** One block of a section: a paragraph (plain, or with links in it) or a bulleted list. */
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

const PARAGRAPH = "text-[17px] text-neutral-200 leading-[1.7]";
const LINK =
	"text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white";
const number = (index: number) => String(index + 1).padStart(2, "0");

function Text({ parts }: { parts: Part[] }) {
	return parts.map((part, index) =>
		typeof part === "string" ? (
			// Parts of a paragraph never reorder, so their position is their key.
			<span key={index}>{part}</span>
		) : (
			<a key={part.href} href={part.href} className={LINK}>
				{part.text}
			</a>
		),
	);
}

function Paragraph({ block }: { block: string | Part[] }) {
	return <p className={PARAGRAPH}>{typeof block === "string" ? block : <Text parts={block} />}</p>;
}

/**
 * A legal document, set like a specification instead of a letter: a label like a path, a big plain title, the date in
 * the machine's own type, an index of the sections, and then each section in two columns on a wide screen, its number
 * and heading on the left, held in view while it is read, and its text on the right, with a hairline above each like
 * a ruled table. The type is heavier, tighter and brighter than the rest of the site's body text, and the bullets are
 * square. The page margins are the article's own padding and the width is on a box inside it, so the margins never
 * squeeze the text. The header and the footer are the site's own.
 */
export function LegalPage({ authUrl, doc }: { authUrl: string; doc: LegalDoc }) {
	useTitle(doc.title);
	return (
		<Frame authUrl={authUrl}>
			<article className="w-full px-(--gutter) pt-36 pb-28 sm:pt-44 sm:pb-40">
				<div data-column className="mx-auto w-full max-w-[64rem]">
					<p className="font-mono text-[13px] text-neutral-500">
						legal / {slug(doc.title).split("-")[0]}
					</p>
					<h1 className="mt-5 font-display font-medium text-[clamp(2.75rem,7vw,5.5rem)] text-white leading-[0.98] tracking-[-0.04em] [text-wrap:balance]">
						{doc.title}
					</h1>
					<p className="mt-6 font-mono text-[13px] text-neutral-500">Last updated {doc.updated}</p>
					{doc.intro?.map((block) => (
						<div
							key={
								typeof block === "string"
									? block
									: block.map((part) => (typeof part === "string" ? part : part.text)).join("")
							}
							className="mt-10 max-w-[44rem]"
						>
							<Paragraph block={block} />
						</div>
					))}
					<nav
						aria-label="On this page"
						className="mt-14 border-white/10 border-t pt-6 font-mono text-[13px]"
					>
						<ol className="gap-x-12 space-y-2 sm:columns-2">
							{doc.sections.map((section, index) => (
								<li key={section.heading}>
									<a
										href={`#${slug(section.heading)}`}
										className="text-neutral-400 transition-colors hover:text-white"
									>
										<span className="inline-block w-9 text-neutral-600">{number(index)}</span>{" "}
										{section.heading}
									</a>
								</li>
							))}
						</ol>
					</nav>
					{doc.sections.map((section, index) => (
						<section
							key={section.heading}
							className="mt-14 grid gap-x-12 gap-y-5 border-white/10 border-t pt-8 md:grid-cols-[13rem_minmax(0,1fr)]"
						>
							<div className="md:sticky md:top-28 md:self-start">
								<span aria-hidden="true" className="font-mono text-[13px] text-neutral-500">
									{number(index)}
								</span>
								<h2
									id={slug(section.heading)}
									className="mt-2 scroll-mt-28 font-display font-medium text-[1.25rem] text-white leading-snug tracking-[-0.02em]"
								>
									{section.heading}
								</h2>
							</div>
							<div className="flex max-w-[44rem] flex-col gap-5">
								{section.body.map((block) =>
									!Array.isArray(block) && typeof block === "object" ? (
										<ul
											key={block.list.join("|")}
											className="list-[square] space-y-2 pl-6 marker:text-neutral-500"
										>
											{block.list.map((item) => (
												<li key={item} className={`${PARAGRAPH} pl-1`}>
													{item}
												</li>
											))}
										</ul>
									) : (
										<Paragraph
											key={
												typeof block === "string"
													? block
													: block
															.map((part) => (typeof part === "string" ? part : part.text))
															.join("")
											}
											block={block}
										/>
									),
								)}
							</div>
						</section>
					))}
				</div>
			</article>
		</Frame>
	);
}
