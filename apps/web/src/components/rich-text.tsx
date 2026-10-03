import type { ReactNode } from "react";

/**
 * The manager's answers, which it writes in a little markdown: headings, bold, and lists. Only those are
 * read; everything else stays plain text, so nothing it writes can become markup or a link.
 */

function inline(text: string): ReactNode[] {
	// **bold** only. Anything unmatched stays as written.
	return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
		part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
			<strong key={index} className="font-medium text-white">
				{part.slice(2, -2)}
			</strong>
		) : (
			part
		),
	);
}

export function RichText({ text }: { text: string }) {
	const blocks: ReactNode[] = [];
	let list: { ordered: boolean; items: string[] } | undefined;
	const flush = () => {
		if (!list) return;
		const items = list.items.map((item, index) => <li key={index}>{inline(item)}</li>);
		blocks.push(
			list.ordered ? (
				<ol key={blocks.length} className="ml-5 list-decimal space-y-1">
					{items}
				</ol>
			) : (
				<ul key={blocks.length} className="ml-5 list-disc space-y-1">
					{items}
				</ul>
			),
		);
		list = undefined;
	};

	for (const line of text.split("\n")) {
		const heading = /^#{1,4}\s+(.*)$/.exec(line);
		const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
		const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
		if (bullet || numbered) {
			const ordered = Boolean(numbered);
			if (list && list.ordered !== ordered) flush();
			list ??= { ordered, items: [] };
			list.items.push((bullet ?? numbered)?.[1] ?? "");
			continue;
		}
		flush();
		if (heading)
			blocks.push(
				<p key={blocks.length} className="pt-2 font-medium text-[16px] text-white">
					{inline(heading[1] ?? "")}
				</p>,
			);
		else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
	}
	flush();
	return <div className="flex flex-col gap-2">{blocks}</div>;
}
