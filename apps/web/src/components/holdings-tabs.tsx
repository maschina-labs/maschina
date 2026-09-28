import { useQueries } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { type MachineDetail, machineQuery, useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { statusOf } from "../lib/status.ts";
import type { Trade } from "../lib/trades.ts";
import { useMachineTrades } from "./portfolio.tsx";

/**
 * Holdings, orders and history, as tabs. Orders are what your machines are waiting to do; history is every
 * trade they made. Holdings are what your own wallet holds, which arrives with live balances.
 */

const TABS = ["ORDERS", "HISTORY", "HOLDINGS"] as const;
type Tab = (typeof TABS)[number];
const ROW =
	"grid grid-cols-[1fr_auto] gap-6 border-white/[0.06] border-b py-2.5 text-[11.5px] tabular-nums tracking-[0.1em]";

export function OrdersView({ machines }: { machines: MachineDetail[] }) {
	const waiting = machines.filter((machine) => machine.state === "running");
	if (waiting.length === 0)
		return <p className="text-[11px] text-neutral-500">NO MACHINE IS WAITING TO TRADE</p>;
	return (
		<ol>
			{waiting.map((machine) => (
				<li key={machine.machineId} className={ROW}>
					<span className="truncate text-neutral-100">{machine.name.toUpperCase()}</span>
					<span className="text-neutral-400">{statusOf(machine)}</span>
				</li>
			))}
		</ol>
	);
}

export function HistoryView({ trades }: { trades: (Trade & { machine: string })[] }) {
	if (trades.length === 0) return <p className="text-[11px] text-neutral-500">NO TRADES YET</p>;
	return (
		<ol>
			{trades.map((trade) => (
				<li
					key={`${trade.machine}${trade.at}`}
					className="grid grid-cols-[auto_1fr_auto] gap-6 border-white/[0.06] border-b py-2.5 text-[11.5px] tabular-nums tracking-[0.1em]"
				>
					<span className="text-neutral-500">
						{new Date(trade.at).toLocaleString("en-CA", { hour12: false })}
					</span>
					<span className="truncate text-neutral-100">
						{trade.machine} · {trade.side === "buy" ? "BOUGHT" : "SOLD"}
					</span>
					<span className="text-neutral-400">AT {trade.price.toFixed(2)}</span>
				</li>
			))}
		</ol>
	);
}

export function HoldingsTabs() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const details = useQueries({
		queries: (session.data ? (machines.data ?? []) : []).map((machine) =>
			machineQuery(api, machine.machineId),
		),
	});
	const trades = useMachineTrades();
	const [tab, setTab] = useState<Tab>("ORDERS");
	return (
		<section aria-label="Orders and history" className="flex flex-col gap-4">
			<fieldset className="flex gap-6 text-[11px] tracking-[0.14em]">
				<legend className="sr-only">Show</legend>
				{TABS.map((each) => (
					<button
						key={each}
						type="button"
						aria-pressed={tab === each}
						onClick={() => setTab(each)}
						className={
							tab === each ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
						}
					>
						{each}
					</button>
				))}
			</fieldset>
			{tab === "ORDERS" ? (
				<OrdersView machines={details.flatMap((detail) => (detail.data ? [detail.data] : []))} />
			) : tab === "HISTORY" ? (
				<HistoryView trades={trades} />
			) : (
				<p className="text-[11px] text-neutral-500 tracking-[0.1em]">
					WHAT YOUR WALLET HOLDS ARRIVES WITH LIVE BALANCES IN THE BACKEND PASS
				</p>
			)}
		</section>
	);
}
