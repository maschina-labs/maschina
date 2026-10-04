import { ArrowUpRight } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { EXPLORERS, txUrl, useExplorer } from "../lib/explorer.ts";

/**
 * One line of a record: when, what, and for a transaction on chain, the way to check it on the owner's
 * explorer. Every line keeps the same columns, so a column of times lines up and the words beside them
 * start in one place, whatever the date.
 */
export function RecordRow({
	at,
	title,
	detail,
	signature,
}: {
	at: string | number;
	title: ReactNode;
	detail?: ReactNode;
	signature?: string | undefined;
}) {
	const explorer = useExplorer();
	return (
		<li className="grid grid-cols-[8.75rem_1fr_auto] items-baseline gap-x-4 border-white/[0.06] border-b py-2.5">
			<time
				className="text-[13px] text-neutral-500 tabular-nums"
				dateTime={new Date(at).toISOString()}
			>
				{new Date(at).toLocaleString("en-US", {
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				})}
			</time>
			<span className="min-w-0 truncate text-[15px] text-neutral-100">
				{title}
				{detail ? <span className="text-neutral-500"> · {detail}</span> : null}
			</span>
			{signature ? (
				<a
					href={txUrl(explorer, signature)}
					target="_blank"
					rel="noreferrer"
					aria-label={`View on ${EXPLORERS[explorer].name}`}
					title={`View on ${EXPLORERS[explorer].name}`}
					className="flex items-center gap-1 text-[12px] text-neutral-500 transition-colors hover:text-neutral-100"
				>
					{EXPLORERS[explorer].name}
					<ArrowUpRight size={12} weight="light" />
				</a>
			) : (
				<span />
			)}
		</li>
	);
}
