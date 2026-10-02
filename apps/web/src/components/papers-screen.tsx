import papers from "virtual:papers";
import { BookOpen } from "@phosphor-icons/react";
import { Tile } from "./bento.tsx";

/**
 * Every paper, in order, one tile each: its number, its title and how long it is. A tile opens the paper
 * itself, to read in the browser or save. They come straight from the master files, so this is always
 * the full and current set.
 */
export function PapersScreen() {
	return (
		<>
			{papers.map((paper) => (
				<Tile
					key={paper.slug}
					label={`${paper.title}, ${paper.pages} pages`}
					href={`/papers/${paper.slug}.pdf`}
				>
					<div className="flex h-full flex-col justify-between p-4">
						<BookOpen size={28} weight="light" className="text-neutral-100" aria-hidden="true" />
						<span className="flex flex-col gap-1">
							<span className="font-display text-[15px] text-neutral-100 leading-tight @[10rem]:text-[17px]">
								{paper.title}
							</span>
							<span className="text-[13px] text-neutral-500 tabular-nums">
								{String(paper.number).padStart(2, "0")} · {paper.pages} pages
							</span>
						</span>
					</div>
				</Tile>
			))}
		</>
	);
}
