import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { byDay, filterActivity, KINDS, type Kind } from "../lib/activity-filter.ts";
import { describeEvent } from "../lib/describe.ts";
import {
	amount,
	holdingOf,
	type MachineSummary,
	useBalances,
	useMachine,
	useRecord,
} from "../lib/machines.ts";
import { compactUsd } from "../lib/market.ts";
import { portfolioPnl } from "../lib/pnl.ts";
import { type ActivityEntry, onPaper, totalsOf } from "../lib/portfolio.ts";
import { useSide } from "../lib/side.ts";
import { bandOf } from "../lib/status.ts";
import { type Print, streamPrints } from "../lib/tape.ts";
import { recordCsv } from "../lib/track-record.ts";
import { tradesFrom } from "../lib/trades.ts";
import { useMachineAtWork } from "./at-work.tsx";
import { sentence, useSolDay } from "./home.tsx";
import { BUTTON, Headline, Note, Panel, QUIET, Rows } from "./kit.tsx";
import { winRate } from "./place-screens.tsx";
import { PnlChartView } from "./pnl-chart.tsx";
import { useActivity, useOperatingPicture, useSidePicture } from "./portfolio.tsx";
import { PriceChart } from "./price-chart.tsx";

/**
 * The screens Home's tiles open: profit, the vault, your machines, decisions, trades, everything that
 * happened, and SOL. Each holds everything about its one subject; the tile it came from is the summary.
 */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const when = (at: string | number) =>
	new Date(at).toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

const signedOut = <Note>Connect your wallet to see your machines.</Note>;

/** One line of a list: when, then what. */
function Entry({ at, children }: { at: string | number; children: React.ReactNode }) {
	return (
		<li className="grid grid-cols-[auto_1fr] gap-x-5 border-white/[0.06] border-b py-2.5">
			<time className="text-[13px] text-neutral-500 tabular-nums">{when(at)}</time>
			<span className="truncate text-[15px] text-neutral-100">{children}</span>
		</li>
	);
}

/** A machine's line in a list, opening it. */
function MachineRow({ machine, value }: { machine: MachineSummary; value: string }) {
	return (
		<Link
			to="/machines/$machineId"
			params={{ machineId: machine.machineId }}
			className="flex items-baseline justify-between gap-4 border-white/[0.06] border-b py-2.5 hover:bg-white/[0.04]"
		>
			<span className="truncate text-[15px] text-neutral-100">
				{machine.name}
				<span className="text-neutral-500">
					{" "}
					· {machine.state}
					{onPaper(machine) ? " · paper" : ""}
				</span>
			</span>
			<span className="shrink-0 font-display text-[15px] text-neutral-100 tabular-nums">
				{value}
			</span>
		</Link>
	);
}

export function ProfitScreen() {
	const picture = useSidePicture();
	const side = useSide();
	const machines = picture.map((each) => each.machine);
	const signedIn = machines.length > 0 || picture.length > 0;
	const points = portfolioPnl(picture.map((each) => each.record));
	const totals = machines.length ? totalsOf(machines, side) : undefined;
	const wins = machines.reduce((sum, m) => sum + m.result.wins, 0);
	const losses = machines.reduce((sum, m) => sum + m.result.losses, 0);
	const fees = machines.reduce((sum, m) => sum + BigInt(m.result.feesLamports), 0n);
	const roundTrips = machines.reduce((sum, m) => sum + m.result.roundTrips, 0);
	const ranked = [...machines].sort((a, b) =>
		Number(BigInt(b.result.realised) - BigInt(a.result.realised)),
	);
	return (
		<>
			<Panel size="big" name="Profit over time">
				{points.length ? (
					<div data-own-drag className="h-full min-h-[160px]">
						<PnlChartView points={points} />
					</div>
				) : (
					<Note>
						{signedIn
							? "Profit shows here once a machine closes a trade."
							: "Connect your wallet to see your profit."}
					</Note>
				)}
			</Panel>
			<Panel size="wide" name="Realized">
				<Headline>{totals ? amount(totals.realized.toString()) : "0.00"} USDC</Headline>
			</Panel>
			<Panel size="wide" name="Round trips">
				<Headline>
					{wins} won, {losses} lost
				</Headline>
				<Note>
					{wins + losses
						? `Win rate ${Math.round((wins / (wins + losses)) * 100)}%`
						: "None closed yet."}
				</Note>
			</Panel>
			<Panel size="wide" name="By machine" scroll>
				{ranked.length
					? ranked.map((m) => (
							<MachineRow
								key={m.machineId}
								machine={m}
								value={`${amount(m.result.realised)} USDC`}
							/>
						))
					: signedOut}
			</Panel>
			<Panel size="wide" name="Costs">
				<Rows
					rows={[
						["Network fees", `${(Number(fees) / 1e9).toFixed(4)} SOL`],
						["Trades", String(totals?.trades ?? 0)],
					]}
				/>
			</Panel>
			{/* What a round trip earns on average: the number a fee or a bad fill is measured against. */}
			<Panel size="wide" name="Per round trip">
				<Headline>
					{totals && roundTrips
						? `${amount((totals.realized / BigInt(roundTrips)).toString())} USDC`
						: "-"}
				</Headline>
				<Note>
					{roundTrips
						? `Across ${roundTrips} round trip${roundTrips === 1 ? "" : "s"}.`
						: "None closed yet."}
				</Note>
			</Panel>
		</>
	);
}

/** One machine's vault, read from the chain. Its own component: each reads its own balance. */
function VaultLine({ machine }: { machine: MachineSummary }) {
	const { api } = useRouter().options.context;
	const balances = useBalances(api, machine.machineId);
	const vault = balances.data?.vault;
	const value = vault
		? `${holdingOf(vault, USDC).toFixed(2)} USDC`
		: balances.isLoading
			? "…"
			: "No vault";
	return <MachineRow machine={machine} value={value} />;
}

export function VaultScreen() {
	const picture = useSidePicture();
	const sweeps = picture
		.flatMap(({ machine, record }) =>
			record
				.filter((entry) => entry.type === "sweep.completed")
				.map((entry) => ({ entry, name: machine.name })),
		)
		.sort((a, b) => b.entry.occurredAt.localeCompare(a.entry.occurredAt));
	return (
		<>
			<Panel size="big" name={`Swept to the vault · ${sweeps.length}`} scroll>
				{sweeps.length ? (
					<ol className="flex flex-col">
						{sweeps.map(({ entry, name }) => (
							<Entry key={entry.id} at={entry.occurredAt}>
								{name} · {sentence(describeEvent(entry).detail || describeEvent(entry).title)}
							</Entry>
						))}
					</ol>
				) : (
					<Note>
						Nothing swept yet. After a profitable sale, a machine banks the profit in its vault.
					</Note>
				)}
			</Panel>
			<Panel size="large" name="Each machine's vault" scroll>
				{picture.length
					? picture.map(({ machine }) => <VaultLine key={machine.machineId} machine={machine} />)
					: signedOut}
			</Panel>
			<Panel size="wide" name="What the vault is">
				<Note>Profit set aside where trading cannot reach it. Only you can take it out.</Note>
			</Panel>
		</>
	);
}

export function FleetScreen() {
	const side = useSide();
	const picture = useOperatingPicture();
	const machines = picture.map((each) => each.machine);
	const totals = machines.length ? totalsOf(machines, side) : undefined;
	// Unspent money counts machines on the side shown that can still act; the sides never mix (D-096).
	const available = machines
		.filter((m) => onPaper(m) === (side === "paper") && m.state !== "stopped")
		.reduce((sum, m) => sum + BigInt(m.budget.available), 0n);
	return (
		<>
			<Panel size="big" name={`Your machines · ${machines.length}`} scroll>
				{machines.length
					? machines.map((m) => (
							<MachineRow
								key={m.machineId}
								machine={m}
								value={`${amount(m.result.realised)} USDC`}
							/>
						))
					: signedOut}
			</Panel>
			<Panel size="large" name="Altogether">
				<Rows
					rows={[
						["Running", `${totals?.running ?? 0} of ${totals?.machines ?? 0}`],
						["Given to trade", `${amount((totals?.granted ?? 0n).toString())} USDC`],
						["Not yet spent", `${amount(available.toString())} USDC`],
						["Holding", `${amount((totals?.holding ?? 0n).toString(), 9)} SOL`],
					]}
				/>
			</Panel>
			<Panel size="wide" name="Another">
				<div>
					<Link to="/new" className={BUTTON}>
						New machine
					</Link>
				</div>
			</Panel>
		</>
	);
}

// What a machine weighed up rather than did: every run it looked, what it meant to do, and what it was
// stopped from doing.
const DECIDED = new Set([
	"run.skipped",
	"trade.intended",
	"trade.refused",
	"trade.simulated",
	"machine.recentred",
	"machine.retuned",
]);

export function DecisionsScreen() {
	const decisions = useActivity().filter((entry) => DECIDED.has(entry.type));
	const refused = decisions.filter((entry) => entry.type === "trade.refused").length;
	const intended = decisions.filter(
		(entry) => entry.type === "trade.intended" || entry.type === "trade.simulated",
	).length;
	return (
		<>
			<Panel size="big" name={`Decisions · ${decisions.length}`} scroll>
				{decisions.length ? (
					<ol className="flex flex-col">
						{decisions.map((entry) => {
							const said = describeEvent(entry);
							return (
								<Entry key={entry.id} at={entry.occurredAt}>
									{entry.machineName} · {sentence(said.title).toLowerCase()}
									{said.detail ? (
										<span className="text-neutral-500">
											{" "}
											· {sentence(said.detail).toLowerCase()}
										</span>
									) : null}
								</Entry>
							);
						})}
					</ol>
				) : (
					<Note>Nothing decided yet.</Note>
				)}
			</Panel>
			<Panel size="large" name="Weighed up">
				<Rows
					rows={[
						["Set out to trade", String(intended)],
						["Stopped by the rules", String(refused)],
						[
							"Looked and waited",
							String(decisions.filter((entry) => entry.type === "run.skipped").length),
						],
					]}
				/>
				<Note>
					Every decision is written down before anything moves, so each one can be checked.
				</Note>
			</Panel>
		</>
	);
}

/** What one machine is waiting to do: the prices it will act at next. */
function OrdersLine({ machine }: { machine: MachineSummary }) {
	const { api } = useRouter().options.context;
	const detail = useMachine(api, machine.machineId);
	const record = useRecord(api, machine.machineId);
	const levels = detail.data ? bandOf(detail.data, record.data ?? []) : [];
	const value =
		machine.state !== "running"
			? sentence(machine.state)
			: levels.length
				? levels.map((level) => `${sentence(level.label)} ${level.price.toFixed(2)}`).join(" · ")
				: "-";
	return <MachineRow machine={machine} value={value} />;
}

export function TradesScreen() {
	const picture = useSidePicture();
	const trades = picture
		.flatMap(({ machine, record }) => tradesFrom(record).map((trade) => ({ ...trade, machine })))
		.sort((a, b) => b.at - a.at);
	const buys = trades.filter((t) => t.side === "buy").length;
	const wins = picture.reduce((sum, each) => sum + each.machine.result.wins, 0);
	const losses = picture.reduce((sum, each) => sum + each.machine.result.losses, 0);
	return (
		<>
			<Panel size="big" name={`Trades · ${trades.length}`} scroll>
				{trades.length ? (
					<ol className="flex flex-col">
						{trades.map((trade) => (
							<Entry key={`${trade.machine.machineId}-${trade.at}-${trade.side}`} at={trade.at}>
								{trade.machine.name} · {trade.side === "buy" ? "bought" : "sold"} SOL at{" "}
								{trade.price.toFixed(2)}
							</Entry>
						))}
					</ol>
				) : (
					<Note>No trades yet.</Note>
				)}
			</Panel>
			<Panel size="large" name="Waiting to" scroll>
				{picture.length ? (
					picture.map(({ machine }) => <OrdersLine key={machine.machineId} machine={machine} />)
				) : (
					<Note>Connect your wallet to see what your machines are waiting to do.</Note>
				)}
			</Panel>
			<Panel size="wide" name="Counted">
				<Rows
					rows={[
						["Buys", String(buys)],
						["Sales", String(trades.length - buys)],
						["Win rate", winRate({ result: { wins, losses } })],
					]}
				/>
			</Panel>
		</>
	);
}

/** Everything every machine recorded, as one CSV, for tax and accounting. */
function download(feed: ActivityEntry[]) {
	const csv = recordCsv(feed);
	const link = document.createElement("a");
	link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
	link.download = `maschina-activity-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(link.href);
}

export function FeedScreen() {
	const feed = useActivity();
	const [kind, setKind] = useState<Kind>("ALL");
	const shown = filterActivity(feed, kind);
	return (
		<>
			<Panel size="big" name={`Everything that happened · ${shown.length}`} scroll>
				{shown.length ? (
					byDay(shown).map(({ day, entries }) => (
						<section key={day} className="flex flex-col">
							<h3 className="pt-3 pb-1 text-[13px] text-neutral-500">{sentence(day)}</h3>
							<ol className="flex flex-col">
								{entries.map((entry) => (
									<Entry key={entry.id} at={entry.occurredAt}>
										{entry.machineName} · {sentence(describeEvent(entry).title).toLowerCase()}
									</Entry>
								))}
							</ol>
						</section>
					))
				) : (
					<Note>Nothing here yet.</Note>
				)}
			</Panel>
			<Panel size="large" name="Show">
				<div className="grid grid-cols-2 gap-1">
					{KINDS.map((each) => (
						<button
							key={each}
							type="button"
							aria-pressed={kind === each}
							onClick={() => setKind(each)}
							className={`py-2 text-[14px] transition-colors ${kind === each ? "bg-white text-neutral-950" : "bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12]"}`}
						>
							{sentence(each)}
						</button>
					))}
				</div>
				<div>
					<button
						type="button"
						disabled={feed.length === 0}
						onClick={() => download(feed)}
						className={QUIET}
					>
						Export everything as CSV
					</button>
				</div>
			</Panel>
		</>
	);
}

const INTERVALS = ["15m", "1h", "4h", "1d"] as const;

/** The last twenty trades in SOL on the market, streaming in. */
export function Tape() {
	const [prints, setPrints] = useState<Print[]>([]);
	useEffect(
		() => streamPrints("SOLUSDT", (print) => setPrints((was) => [print, ...was].slice(0, 20))),
		[],
	);
	if (prints.length === 0) return <Note>Listening to the market…</Note>;
	return (
		<ol className="flex flex-col">
			{prints.map((print) => (
				<li
					key={print.id}
					className="grid grid-cols-[auto_1fr_auto] gap-x-4 border-white/[0.06] border-b py-1.5 text-[14px] tabular-nums"
				>
					<span className="text-neutral-500">
						{new Date(print.at).toLocaleTimeString([], { hour12: false })}
					</span>
					<span className={print.side === "buy" ? "text-neutral-100" : "text-neutral-400"}>
						{print.side === "buy" ? "Bought" : "Sold"} at {print.price.toFixed(2)}
					</span>
					<span className="text-right text-neutral-500">{print.size.toFixed(2)} SOL</span>
				</li>
			))}
		</ol>
	);
}

export function SolScreen() {
	const day = useSolDay();
	const { machine, record } = useMachineAtWork();
	const [interval, setInterval] = useState<(typeof INTERVALS)[number]>("1h");
	return (
		<>
			<Panel size="big" name={`SOL · ${interval}`}>
				<div data-own-drag className="h-full min-h-[200px]">
					<PriceChart
						key={interval}
						interval={interval}
						history={300}
						levels={machine ? bandOf(machine, record) : []}
						trades={tradesFrom(record)}
					/>
				</div>
			</Panel>
			<Panel size="large" name="Today">
				{day ? (
					<Rows
						rows={[
							["Price", day.last.toFixed(2)],
							["Change", `${day.changePct >= 0 ? "+" : ""}${day.changePct.toFixed(2)}%`],
							["High", day.high.toFixed(2)],
							["Low", day.low.toFixed(2)],
							["Volume", compactUsd(day.volumeUsd)],
						]}
					/>
				) : (
					<Note>Reading the market…</Note>
				)}
			</Panel>
			<Panel size="wide" name="Trades on the market" scroll>
				<Tape />
			</Panel>
			<Panel size="wide" name="Each candle">
				<div className="grid grid-cols-4 gap-1">
					{INTERVALS.map((each) => (
						<button
							key={each}
							type="button"
							aria-pressed={interval === each}
							onClick={() => setInterval(each)}
							className={`py-2 text-[14px] transition-colors ${interval === each ? "bg-white text-neutral-950" : "bg-white/[0.06] text-neutral-300 hover:bg-white/[0.12]"}`}
						>
							{each}
						</button>
					))}
				</div>
			</Panel>
		</>
	);
}
