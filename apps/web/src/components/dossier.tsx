import { Link } from "@tanstack/react-router";
import type { Finding } from "../lib/analyst.ts";
import { describeEvent } from "../lib/describe.ts";
import type { Graph, Node } from "../lib/intel.ts";
import type { RecordEntry } from "../lib/machines.ts";

const LABEL = "text-[9.5px] text-neutral-500 tracking-[0.16em]";
const KINDS: Record<Node["kind"], string> = {
	wallet: "WALLET",
	machine: "MACHINE",
	vault: "VAULT",
	token: "TOKEN",
};

/**
 * One object's dossier: what it is, where it lives on chain, what it is linked to, what happened to it,
 * and the analyst's brief. Rules write the brief now; asking the analyst in words arrives with the AI.
 */
export function Dossier({
	node,
	graph,
	events,
	brief,
	onSelect,
}: {
	node: Node | undefined;
	graph: Graph;
	events: RecordEntry[];
	brief: Finding[];
	onSelect: (id: string) => void;
}) {
	if (!node) return <p className={LABEL}>SELECT AN OBJECT</p>;
	const links = graph.links.filter((link) => link.from === node.id || link.to === node.id);
	const byId = new Map(graph.nodes.map((each) => [each.id, each]));
	return (
		<article aria-label={`${node.code} dossier`} className="flex flex-col gap-6">
			<header className="flex flex-col gap-1.5">
				<span className={LABEL}>
					{KINDS[node.kind]} {"//"} {node.code}
				</span>
				<h2 className="text-[16px] text-neutral-100 tracking-[0.1em]">{node.label}</h2>
				{node.address ? (
					<a
						href={`https://solscan.io/account/${node.address}`}
						target="_blank"
						rel="noreferrer"
						className="break-all text-[10px] text-neutral-500 tracking-[0.06em] hover:text-neutral-200"
					>
						{node.address} ↗
					</a>
				) : null}
				{node.machineId && node.kind === "machine" ? (
					<Link
						to="/machines/$machineId"
						params={{ machineId: node.machineId }}
						className="text-[10px] text-neutral-400 tracking-[0.14em] hover:text-neutral-100"
					>
						OPEN ITS PAGE →
					</Link>
				) : null}
			</header>

			<section aria-label="Analyst" className="flex flex-col gap-2.5">
				<span className={LABEL}>{"ANALYST // BRIEF"}</span>
				{brief.length === 0 ? (
					<span className="text-[10.5px] text-neutral-500">NOTHING TO REPORT</span>
				) : null}
				{brief.map((finding) => (
					<p
						key={finding.text}
						className={`flex gap-2 text-[10.5px] leading-relaxed tracking-[0.08em] ${finding.level === "watch" ? "text-neutral-100" : "text-neutral-400"}`}
					>
						<span aria-hidden="true">{finding.level === "watch" ? "■" : "·"}</span>
						{finding.text}
					</p>
				))}
				<input
					disabled
					placeholder="ASK THE ANALYST · ARRIVES WITH THE AI"
					className="h-9 border border-white/10 bg-transparent px-3 text-[10px] tracking-[0.1em] placeholder:text-neutral-600"
				/>
			</section>

			<section aria-label="Links" className="flex flex-col gap-2">
				<span className={LABEL}>LINKS</span>
				{links.map((link) => {
					const other = byId.get(link.from === node.id ? link.to : link.from);
					if (!other) return null;
					return (
						<button
							key={`${link.from}-${link.to}`}
							type="button"
							onClick={() => onSelect(other.id)}
							className="flex justify-between gap-3 text-left text-[10.5px] tracking-[0.1em] text-neutral-300 hover:text-neutral-100"
						>
							<span>
								{link.kind.toUpperCase()} → {other.label}
							</span>
							<span className="text-neutral-600">{other.code}</span>
						</button>
					);
				})}
			</section>

			{events.length > 0 ? (
				<section aria-label="Events" className="flex flex-col gap-2">
					<span className={LABEL}>EVENTS</span>
					{[...events]
						.reverse()
						.slice(0, 8)
						.map((entry) => (
							<p key={entry.id} className="flex gap-3 text-[10px] tracking-[0.08em]">
								<span className="text-neutral-600 tabular-nums">
									{new Date(entry.occurredAt).toLocaleTimeString("en-CA", { hour12: false })}
								</span>
								<span className="text-neutral-300">{describeEvent(entry).title}</span>
							</p>
						))}
				</section>
			) : null}
		</article>
	);
}
