import { useQueries } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { amount, recordQueryFor, useMachines } from "../lib/machines.ts";
import { portfolioPnl } from "../lib/pnl.ts";
import {
	type ActivityEntry,
	activityOf,
	type Totals as TotalsData,
	totalsOf,
} from "../lib/portfolio.ts";
import { useSession } from "../lib/session.ts";
import { PnlChartView } from "./pnl-chart.tsx";

function Figure({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-[11px] text-neutral-500">{label}</span>
			<span className="text-[18px] text-neutral-100 tabular-nums">{value}</span>
		</div>
	);
}

/** Plain for now: exposed first, styled once everything is on the page. */
export function TotalsView({ totals }: { totals: TotalsData }) {
	return (
		<div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
			<Figure label="IN PLAY" value={`${amount(totals.granted.toString())} USDC`} />
			<Figure label="REALISED" value={`${amount(totals.realised.toString())} USDC`} />
			<Figure label="HOLDING" value={`${amount(totals.holding.toString(), 9)} SOL`} />
			<Figure label="RUNNING" value={`${totals.running} OF ${totals.machines}`} />
			{totals.simulated ? (
				<p className="col-span-full text-[11px] text-neutral-500">INCLUDES PAPER MACHINES</p>
			) : null}
		</div>
	);
}

export function ActivityView({ feed }: { feed: ActivityEntry[] }) {
	if (feed.length === 0) return <p className="text-[12px] text-neutral-500">NOTHING YET</p>;
	return (
		<ol aria-label="Activity" className="flex flex-col">
			{feed.map((entry) => (
				<li
					key={entry.id}
					className="grid grid-cols-[auto_1fr_auto] gap-4 border-white/[0.06] border-b py-2 text-[11px]"
				>
					<time className="text-neutral-500 tabular-nums" dateTime={entry.occurredAt}>
						{new Date(entry.occurredAt).toLocaleString("en-CA", { hour12: false })}
					</time>
					<span className="truncate text-neutral-200">{entry.type.toUpperCase()}</span>
					<span className="truncate text-neutral-500">{entry.machineName}</span>
				</li>
			))}
		</ol>
	);
}

/** The signed in owner's machines and every record, read once for whichever half a page shows. */
function useEverything() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const records = useQueries({
		queries: (machines.data ?? []).map((machine) => recordQueryFor(api, machine.machineId)),
	});
	const signedIn = Boolean(session.data);
	const feed = activityOf(
		(machines.data ?? []).map((machine, index) => ({
			machine,
			events: records[index]?.data ?? [],
		})),
	);
	const all = records.map((record) => record.data ?? []);
	return { signedIn, machines: machines.data, feed, records: all };
}

const SIGN_IN = <p className="text-[12px] text-neutral-500">CONNECT TO SEE YOUR MACHINES</p>;

export function Totals() {
	const { signedIn, machines } = useEverything();
	if (!signedIn) return SIGN_IN;
	if (!machines) return <p className="text-[12px] text-neutral-500">…</p>;
	return <TotalsView totals={totalsOf(machines)} />;
}

/** Every machine's record as one feed, newest first; empty until someone is signed in. */
export function useActivity() {
	const { signedIn, feed } = useEverything();
	return signedIn ? feed : [];
}

export function Activity() {
	const { signedIn, machines, feed } = useEverything();
	if (!signedIn) return SIGN_IN;
	if (!machines) return <p className="text-[12px] text-neutral-500">…</p>;
	return <ActivityView feed={feed} />;
}

/** Per machine: what it was given, what it has taken, what it holds. */
export function Breakdown() {
	const { signedIn, machines } = useEverything();
	if (!signedIn || !machines) return null;
	return (
		<ol aria-label="By machine" className="flex flex-col">
			{machines.map((machine) => (
				<li
					key={machine.machineId}
					className="grid grid-cols-[1fr_auto_auto_auto] gap-6 border-white/[0.06] border-b py-2 text-[12px] tabular-nums"
				>
					<span className="truncate text-neutral-200">{machine.name}</span>
					<span className="text-neutral-500">{amount(machine.budget.granted)} USDC</span>
					<span className="text-neutral-100">{amount(machine.result.realised)} USDC</span>
					<span className="text-neutral-500">{amount(machine.result.position, 9)} SOL</span>
				</li>
			))}
		</ol>
	);
}

/** Realised profit across every machine, over time. */
export function Pnl() {
	const { signedIn, machines, records } = useEverything();
	if (!signedIn || !machines) return null;
	return <PnlChartView points={portfolioPnl(records)} />;
}
