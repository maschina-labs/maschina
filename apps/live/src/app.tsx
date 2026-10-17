import type { PaperTrade, PublicTrade } from "@maschina/contracts";
import { useEffect, useState } from "react";
import { amount, priceOf } from "./format.ts";
import { type RecordState, readRecord } from "./record.ts";

/**
 * The public record: every trade the machines made, with no account and no wallet.
 *
 * Two tables, never one. Real money carries the signature that proves it on Solana; paper carries
 * none, because a paper machine signs nothing, so there is nothing to link to. The shapes make that
 * impossible to get wrong: a paper trade has no signature field for a link to be built from.
 *
 * Nothing is added across the two (D-096), and every machine the house owns appears here, running or
 * stopped, because a record that leaves out what failed proves nothing (D-108).
 */

const when = (at: string) =>
	new Date(at).toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

const CELL = "py-3 pr-4 tabular-nums";
const HEAD = "py-2 pr-4 font-normal";

function Head({ proof }: { proof: boolean }) {
	return (
		<thead>
			<tr className="border-white/20 border-b text-left text-[11px] text-neutral-500 uppercase tracking-widest">
				<th className={HEAD}>Time</th>
				<th className={HEAD}>Side</th>
				<th className={`${HEAD} text-right`}>SOL</th>
				<th className={`${HEAD} text-right`}>USDC</th>
				<th className={`${HEAD} text-right`}>Price</th>
				{proof ? <th className="py-2 text-right font-normal">Chain</th> : null}
			</tr>
		</thead>
	);
}

function Cells({ trade }: { trade: PaperTrade }) {
	return (
		<>
			<td className={`${CELL} whitespace-nowrap text-neutral-400`}>{when(trade.at)}</td>
			<td className={`${CELL} text-white`}>{trade.side === "buy" ? "Buy" : "Sell"}</td>
			<td className={`${CELL} text-right`}>{amount(trade.sol, 9)}</td>
			<td className={`${CELL} text-right`}>{amount(trade.usdc, 6)}</td>
			<td className={`${CELL} text-right`}>{priceOf(trade.usdc, trade.sol) ?? "-"}</td>
		</>
	);
}

function Table({
	trades,
	caption,
}: {
	trades: readonly (PublicTrade | PaperTrade)[];
	caption: string;
}) {
	const proof = trades.some((trade) => "signature" in trade);
	return (
		// Scrolls sideways rather than clipping. On a phone the proof column used to fall off the
		// edge, which made the page's own promise, that every line links to the chain, untrue there.
		<div className="-mx-6 overflow-x-auto px-6">
			<table className="w-full min-w-[34rem] text-sm">
				<caption className="sr-only">{caption}</caption>
				<Head proof={proof} />
				<tbody>
					{trades.map((trade) => (
						<tr
							key={"signature" in trade ? trade.signature : `${trade.at}-${trade.side}`}
							className="border-white/10 border-b"
						>
							<Cells trade={trade} />
							{proof ? (
								<td className="py-3 text-right">
									{"signature" in trade ? (
										<a
											href={`https://solscan.io/tx/${trade.signature}`}
											target="_blank"
											rel="noopener noreferrer"
											className="text-neutral-400 underline-offset-4 hover:text-white hover:underline"
										>
											Proof
										</a>
									) : null}
								</td>
							) : null}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function Section({
	title,
	note,
	children,
}: {
	title: string;
	note: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-14 first:mt-0">
			<h2 className="text-white text-xl">{title}</h2>
			<p className="mt-1 mb-5 max-w-xl text-neutral-500 text-sm">{note}</p>
			{children}
		</section>
	);
}

const Empty = ({ children }: { children: string }) => (
	<p className="text-neutral-500 text-sm">{children}</p>
);

export function LiveApp({ gateway = "" }: { gateway?: string }) {
	const [state, setState] = useState<RecordState>({ status: "loading" });

	useEffect(() => {
		document.title = "Live Record | Maschina";
	}, []);

	useEffect(() => {
		let current = true;
		const read = async () => {
			const answer = await readRecord(gateway);
			if (!current) return;
			setState(answer.ok ? { status: "ready", record: answer.record } : { status: "failed" });
		};
		void read();
		// The gateway shares one answer for twenty seconds, so asking more often than that only costs
		// the browser something.
		const again = setInterval(read, 30_000);
		return () => {
			current = false;
			clearInterval(again);
		};
	}, [gateway]);

	return (
		<main aria-label="Live Record" className="min-h-svh bg-black px-6 py-16 text-neutral-200">
			<div className="mx-auto w-full max-w-4xl">
				<a href="https://maschina.dev" aria-label="Maschina">
					<img src="/brand/wordmark.svg" alt="" className="mb-10 h-5 w-auto" />
				</a>
				<h1 className="mb-2 font-medium text-3xl text-white">The record</h1>
				<p className="mb-4 max-w-xl text-neutral-400">
					Every trade these machines finish. Nothing here can be edited after the fact, no machine
					is left out, and the ones that lost money are on it too.
				</p>

				{state.status === "loading" && <p className="text-neutral-500">Reading the record.</p>}

				{state.status === "failed" && (
					<p role="alert" className="border border-white/20 px-3 py-2 text-neutral-400 text-sm">
						The record could not be read just now. It will try again in a moment.
					</p>
				)}

				{state.status === "ready" && (
					<>
						<Section
							title="Real money"
							note="Traded with the founder's own funds. Every line links to the transaction on Solana, so none of it has to be taken on trust."
						>
							{state.record.live.length === 0 ? (
								<Empty>No finished trades with real money yet.</Empty>
							) : (
								<Table trades={state.record.live} caption="Trades made with real money" />
							)}
						</Section>

						<Section
							title="Paper"
							note="Real prices, real decisions, no money. A machine on paper signs nothing, so these have no transaction to link to and are never added to the figures above."
						>
							{state.record.paper.length === 0 ? (
								<Empty>No paper trades yet.</Empty>
							) : (
								<Table trades={state.record.paper} caption="Trades made on paper" />
							)}
						</Section>
					</>
				)}

				<p className="mt-16 max-w-xl border-white/10 border-t pt-6 text-neutral-600 text-xs">
					This is what the application reports. It is not, by itself, proof that the controls behind
					it hold. Maschina is early and has not had an independent security audit.
				</p>
			</div>
		</main>
	);
}
