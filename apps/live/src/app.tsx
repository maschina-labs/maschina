import type { PublicTrade } from "@maschina/contracts";
import { amount, priceOf } from "./format.ts";
import type { RecordState } from "./record.ts";

/**
 * The public record: every finished trade of the machine chosen to be shown, with the signature that proves it on the
 * chain. No account, no wallet, no owner: only what the gateway's open route lets out.
 */

const when = (at: string) =>
	new Date(at).toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

function Row({ trade }: { trade: PublicTrade }) {
	return (
		<tr className="border-white/10 border-b">
			<td className="py-3 pr-4 text-neutral-400 tabular-nums">{when(trade.at)}</td>
			<td className="py-3 pr-4 text-white">{trade.side === "buy" ? "Buy" : "Sell"}</td>
			<td className="py-3 pr-4 text-right tabular-nums">{amount(trade.sol, 9)}</td>
			<td className="py-3 pr-4 text-right tabular-nums">{amount(trade.usdc, 6)}</td>
			<td className="py-3 pr-4 text-right tabular-nums">{priceOf(trade.usdc, trade.sol) ?? "-"}</td>
			<td className="py-3 text-right">
				<a
					href={`https://solscan.io/tx/${trade.signature}`}
					target="_blank"
					rel="noopener noreferrer"
					className="text-neutral-400 underline-offset-4 hover:text-white hover:underline"
				>
					Proof
				</a>
			</td>
		</tr>
	);
}

export function LiveApp({ state }: { state: RecordState }) {
	return (
		<main className="min-h-svh bg-black px-6 py-16 font-display text-neutral-200">
			<div className="mx-auto w-full max-w-4xl">
				<a href="https://maschina.dev" aria-label="Maschina">
					<img src="/brand/wordmark.svg" alt="" className="mb-10 h-5 w-auto" />
				</a>
				<h1 className="mb-2 text-3xl font-medium text-white">The live record</h1>
				<p className="mb-10 max-w-xl text-neutral-400">
					Every trade this machine finishes, with the signature that proves it on Solana. Nothing
					here can be edited after the fact.
				</p>
				{state.status === "loading" && <p className="text-neutral-400">Reading the record.</p>}
				{state.status === "failed" && (
					<p
						role="alert"
						className="border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200"
					>
						We could not read the record. It will try again in a moment.
					</p>
				)}
				{state.status === "ready" && state.trades.length === 0 && (
					<p className="text-neutral-400">No trades on the record yet.</p>
				)}
				{state.status === "ready" && state.trades.length > 0 && (
					<table className="w-full text-sm">
						<thead>
							<tr className="border-white/20 border-b text-left text-[11px] text-neutral-500 uppercase tracking-widest">
								<th className="py-2 pr-4 font-normal">Time</th>
								<th className="py-2 pr-4 font-normal">Side</th>
								<th className="py-2 pr-4 text-right font-normal">SOL</th>
								<th className="py-2 pr-4 text-right font-normal">USDC</th>
								<th className="py-2 pr-4 text-right font-normal">Price</th>
								<th className="py-2 text-right font-normal">Chain</th>
							</tr>
						</thead>
						<tbody>
							{state.trades.map((trade) => (
								<Row key={trade.signature} trade={trade} />
							))}
						</tbody>
					</table>
				)}
			</div>
		</main>
	);
}
