import { useQueries } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { standings, type Window } from "../lib/leaderboard.ts";
import { amount, type MachineSummary, recordQueryFor, useMachines } from "../lib/machines.ts";
import { type ActivityEntry, activityOf, type Totals as TotalsData } from "../lib/portfolio.ts";
import { useSession } from "../lib/session.ts";
import { tradesFrom } from "../lib/trades.ts";

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
		500,
	);
	const all = records.map((record) => record.data ?? []);
	return { signedIn, machines: machines.data, feed, records: all };
}

/** Every machine's record as one feed, newest first; empty until someone is signed in. */
export function useActivity() {
	const { signedIn, feed } = useEverything();
	return signedIn ? feed : [];
}

/** Per machine: what it was given, what it has taken, what it holds. */
/** Each machine's share of everything in play, as whole percentages that always add to 100. */
export function sharesOf(machines: MachineSummary[]): { machineId: string; share: number }[] {
	const total = machines.reduce((sum, machine) => sum + BigInt(machine.budget.granted), 0n);
	if (total === 0n) return machines.map((machine) => ({ machineId: machine.machineId, share: 0 }));
	return machines.map((machine) => ({
		machineId: machine.machineId,
		share: Number((BigInt(machine.budget.granted) * 1000n) / total) / 10,
	}));
}

/** Where the money is: one row of thin segments per machine, lit by its share, then its own figures. */
export function BreakdownView({ machines }: { machines: MachineSummary[] }) {
	const shares = new Map(sharesOf(machines).map((each) => [each.machineId, each.share]));
	return (
		<ol aria-label="By machine" className="grid gap-px sm:grid-cols-2">
			{machines.map((machine) => {
				const share = shares.get(machine.machineId) ?? 0;
				const lit = Math.round(share / 2.5);
				return (
					<li
						key={machine.machineId}
						className="flex flex-col gap-3 border-white/[0.07] border-t p-4"
					>
						<div className="flex items-baseline justify-between gap-4 text-[11px] tracking-[0.12em]">
							<span className="truncate text-neutral-100">{machine.name.toUpperCase()}</span>
							<span className="text-neutral-500">{machine.state.toUpperCase()}</span>
						</div>
						<div className="flex h-4 gap-[3px]" aria-hidden="true">
							{Array.from({ length: 40 }, (_, index) => (
								<span
									key={index}
									className={`w-full ${index < lit ? "bg-neutral-100" : "bg-white/10"}`}
								/>
							))}
						</div>
						<div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-neutral-400 tabular-nums tracking-[0.08em]">
							<span className="text-neutral-100">{share.toFixed(1)}% OF IN PLAY</span>
							<span>FLOAT {amount(machine.budget.granted)}</span>
							<span>REALISED {amount(machine.result.realised)}</span>
							<span>{machine.result.trades} TRADES</span>
						</div>
					</li>
				);
			})}
		</ol>
	);
}

/** Every trade your machines made, newest first, for the machine tape. */
export function useMachineTrades() {
	const { signedIn, machines, records } = useEverything();
	if (!signedIn || !machines) return [];
	return machines
		.flatMap((machine, index) =>
			tradesFrom(records[index] ?? []).map((trade) => ({
				...trade,
				machine: machine.name.toUpperCase(),
			})),
		)
		.sort((a, b) => b.at - a.at)
		.slice(0, 20);
}

/** Your machines, ranked for the leaderboard over a window. */
export function useStandings() {
	const { signedIn, machines, records } = useEverything();
	return (window: Window) =>
		signedIn && machines
			? standings(
					machines.map((machine, index) => ({ machine, record: records[index] ?? [] })),
					window,
				)
			: [];
}

/** Every machine with its record, for the operating picture. */
export function useOperatingPicture() {
	const { signedIn, machines, records } = useEverything();
	return signedIn && machines
		? machines.map((machine, index) => ({ machine, record: records[index] ?? [] }))
		: [];
}
