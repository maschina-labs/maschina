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

const PARAGRAPH = "text-[17px] text-neutral-300 leading-[1.75]";
const LINK =
	"text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white";

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
 * A legal document, set the way the others are: a single narrow column of text in the middle of the page, with good
 * type and nothing else. A short list of the sections at the top to jump to, each section's heading numbered and
 * given an address, and the date it was last changed. The header and the footer are the site's own.
 */
export function LegalPage({ authUrl, doc }: { authUrl: string; doc: LegalDoc }) {
	useTitle(doc.title);
	return (
		<Frame authUrl={authUrl}>
			<article className="w-full px-(--gutter) pt-36 pb-28 sm:pt-44 sm:pb-40">
				<div data-column className="mx-auto w-full max-w-[44rem]">
					<h1 className="font-display font-normal text-[clamp(2.25rem,5vw,3.5rem)] text-white leading-[1.05] tracking-[-0.03em] [text-wrap:balance]">
						{doc.title}
					</h1>
					<p className="mt-4 text-[14px] text-neutral-500">Last updated {doc.updated}</p>
					{doc.intro?.map((block) => (
						<div
							key={
								typeof block === "string"
									? block
									: block.map((part) => (typeof part === "string" ? part : part.text)).join("")
							}
							className="mt-8"
						>
							<Paragraph block={block} />
						</div>
					))}
					<nav aria-label="On this page" className="mt-12">
						<ol className="flex flex-col gap-2 text-[15px]">
							{doc.sections.map((section, index) => (
								<li key={section.heading}>
									<a
										href={`#${slug(section.heading)}`}
										className="text-neutral-400 transition-colors hover:text-white"
									>
										{index + 1}. {section.heading}
									</a>
								</li>
							))}
						</ol>
					</nav>
					{doc.sections.map((section, index) => (
						<section key={section.heading} className="mt-16">
							<h2
								id={slug(section.heading)}
								className="scroll-mt-28 font-display font-normal text-[1.5rem] text-white leading-snug tracking-[-0.02em]"
							>
								{index + 1}. {section.heading}
							</h2>
							<div className="mt-5 flex flex-col gap-5">
								{section.body.map((block) =>
									!Array.isArray(block) && typeof block === "object" ? (
										<ul
											key={block.list.join("|")}
											className="list-disc space-y-2 pl-6 marker:text-neutral-600"
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
