import { Link } from "@tanstack/react-router";
import { amount, type MachineSummary } from "../lib/machines.ts";
import { GLASS } from "./glass.ts";

/**
 * The marketplace, shown with your own machines as they would appear listed: kind, record and results,
 * all real. Nothing is invented. Publishing, copying with your own budget, and the creator's share (D-012)
 * arrive later.
 */

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";

/** The share of finished round trips that made money, or nothing before the first one. */
export function winRate(machine: MachineSummary): string {
	const done = machine.result.wins + machine.result.losses;
	return done === 0 ? "-" : `${Math.round((machine.result.wins / done) * 100)}%`;
}

function ListingCard({ machine }: { machine: MachineSummary }) {
	return (
		<article aria-label={machine.name} className={`flex flex-col gap-4 p-4 ${GLASS}`}>
			<header className="flex items-baseline justify-between gap-3">
				<h3 className="truncate text-[12px] text-neutral-100 tracking-[0.12em]">
					{machine.name.toUpperCase()}
				</h3>
				<span className={LABEL}>{machine.kind.toUpperCase()}</span>
			</header>
			<dl className="grid grid-cols-3 gap-3">
				{(
					[
						["REALISED", `${amount(machine.result.realised)}`],
						["TRADES", String(machine.result.trades)],
						["WON", winRate(machine)],
					] as const
				).map(([term, value]) => (
					<div key={term} className="flex flex-col gap-1">
						<dt className={LABEL}>{term}</dt>
						<dd className="text-[16px] text-neutral-100 tabular-nums">{value}</dd>
					</div>
				))}
			</dl>
			<div className="flex items-center justify-between gap-3">
				<span className="text-[10px] text-neutral-600 tracking-[0.1em]">
					{machine.result.simulated ? "RECORD ON PAPER" : "RECORD WITH REAL MONEY"}
				</span>
				<div className="flex gap-1.5">
					<Link
						to="/machines/$machineId"
						params={{ machineId: machine.machineId }}
						className="border border-white/15 px-3 py-1.5 text-[10.5px] text-neutral-300 tracking-[0.12em] hover:text-neutral-100"
					>
						RECORD
					</Link>
					<button
						type="button"
						disabled
						className="border border-white/25 px-3 py-1.5 text-[10.5px] text-neutral-100 tracking-[0.12em] disabled:opacity-40"
					>
						COPY
					</button>
				</div>
			</div>
		</article>
	);
}

export function MarketplaceView({ machines }: { machines: MachineSummary[] }) {
	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[11.5px] text-neutral-400 leading-relaxed tracking-[0.08em]">
				MACHINES WITH A RECORD YOU CAN CHECK, READY TO COPY WITH YOUR OWN BUDGET AND LIMITS. THE
				CREATOR EARNS A SHARE OF WHAT THE COPIES MAKE. BELOW ARE YOUR OWN MACHINES AS THEY WOULD
				APPEAR LISTED.
			</p>
			{machines.length === 0 ? (
				<p className={LABEL}>MAKE A MACHINE TO SEE HOW IT WOULD LOOK HERE</p>
			) : null}
			<div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
				{machines.map((machine) => (
					<ListingCard key={machine.machineId} machine={machine} />
				))}
			</div>
			<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
				PUBLISHING AND COPYING OPEN LATER
			</p>
		</div>
	);
}
