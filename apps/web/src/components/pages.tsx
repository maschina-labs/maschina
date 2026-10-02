import { followingRange } from "@maschina/runtime";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { briefOn } from "../lib/analyst.ts";
import { describeEvent } from "../lib/describe.ts";
import { KIND_CARDS } from "../lib/kinds.ts";
import { amount, useMachines } from "../lib/machines.ts";
import { portfolioPnl } from "../lib/pnl.ts";
import { totalsOf } from "../lib/portfolio.ts";
import { fetchQuote, type Token } from "../lib/quote.ts";
import { useSession } from "../lib/session.ts";
import { executionBps, holdingReturn, largestDrop } from "../lib/track-record.ts";
import { useMachineAtWork } from "./at-work.tsx";
import { Tile, TileEmpty, TileLoading, type TileSize } from "./bento.tsx";
import { Figure, Line, sentence, useSolDay } from "./home.tsx";
import { Tape } from "./money-screens.tsx";
import { PnlChartView } from "./pnl-chart.tsx";
import { useActivity, useOperatingPicture } from "./portfolio.tsx";

/**
 * The tiles of every section but Home and Network, each page filling the six by three at most. Every
 * tile has one job, shows real figures or says plainly that there are none yet, and opens its own
 * screen for the whole of it.
 */

const signedOut = <TileEmpty>Connect to see your machines.</TileEmpty>;
const when = (at: string | number) =>
	new Date(at).toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
const DAY = 86_400_000;

function useSignedIn() {
	const { api } = useRouter().options.context;
	return Boolean(useSession(api).data);
}

/**
 * Signed out, a personal section has nothing of yours to show, so it is a full grid of tiles asking you to
 * connect: one of a few arrangements that fill the six by three exactly, picked once per visit.
 */
const SIGNED_OUT_LAYOUTS: TileSize[][] = [
	["big", "wide", "wide", "wide", "wide", "wide"],
	["large", "large", "large", "wide", "wide", "wide"],
	["hero", "wide", "wide", "wide"],
	["big", "large", "wide", "wide", "wide"],
];
const SIGNED_OUT_PICK = Math.random();

export function SignedOutGrid({ pick = SIGNED_OUT_PICK }: { pick?: number }) {
	const layout = SIGNED_OUT_LAYOUTS[Math.floor(pick * SIGNED_OUT_LAYOUTS.length)] ?? [];
	return (
		<>
			{layout.map((size, index) => (
				// The arrangement never changes while it is on screen, so a tile's place is its identity.
				// biome-ignore lint/suspicious/noArrayIndexKey: see above
				<Tile key={index} size={size} label="Connect to see your machines">
					{signedOut}
				</Tile>
			))}
		</>
	);
}

/** Portfolio: your money, over time and right now. */
function PortfolioTilesSignedIn() {
	const signedIn = useSignedIn();
	const picture = useOperatingPicture();
	const machines = picture.map((each) => each.machine);
	const totals = machines.length ? totalsOf(machines) : undefined;
	const points = portfolioPnl(picture.map((each) => each.record));
	const fees = machines.reduce((sum, machine) => sum + BigInt(machine.result.feesLamports), 0n);
	const best = [...machines].sort((a, b) =>
		Number(BigInt(b.result.realised) - BigInt(a.result.realised)),
	)[0];

	return (
		<>
			<Tile size="big" label="Profit over time" to="/profit">
				{!signedIn ? (
					signedOut
				) : points.length ? (
					<>
						<div data-own-drag className="absolute inset-x-2 top-2 bottom-10">
							<PnlChartView points={points} />
						</div>
						<span className="absolute bottom-4 left-4 text-[13px] text-neutral-500">
							Profit over time
						</span>
					</>
				) : (
					<TileEmpty>Profit shows here once a machine closes a trade.</TileEmpty>
				)}
			</Tile>
			<Tile size="wide" label="Realised" to="/profit">
				{!signedIn ? (
					signedOut
				) : (
					<Figure
						value={totals ? amount(totals.realised.toString()) : "0.00"}
						note="USDC, realised"
						name="Realised"
					/>
				)}
			</Tile>
			<Tile size="wide" label="In play" to="/fleet">
				{!signedIn ? (
					signedOut
				) : (
					<Figure
						value={totals ? amount(totals.granted.toString()) : "0.00"}
						note="USDC given to machines"
						name="In play"
					/>
				)}
			</Tile>
			<Tile size="wide" label="Holding" to="/fleet">
				{!signedIn ? (
					signedOut
				) : (
					<Figure
						value={totals ? amount(totals.holding.toString(), 9) : "0.00"}
						note="SOL your machines hold"
						name="Holding"
					/>
				)}
			</Tile>
			<Tile size="wide" label="Fees paid" to="/profit">
				{!signedIn ? (
					signedOut
				) : (
					<Figure
						value={(Number(fees) / 1e9).toFixed(4)}
						note="SOL in network fees"
						name="Fees paid"
					/>
				)}
			</Tile>
			<Tile
				size="wide"
				label="Best machine"
				{...(best ? { to: `/machines/${best.machineId}` } : {})}
			>
				{!signedIn ? (
					signedOut
				) : best ? (
					<Line name="Best machine">
						{best.name}
						<span className="block text-[14px] text-neutral-400">
							{amount(best.result.realised)} USDC realised
						</span>
					</Line>
				) : (
					<TileEmpty>No machines yet.</TileEmpty>
				)}
			</Tile>
		</>
	);
}

/** Machines: one tile each, then a new one. */
function MachinesTilesSignedIn() {
	const { api } = useRouter().options.context;
	const signedIn = useSignedIn();
	const machines = useMachines(api);
	if (!signedIn)
		return (
			<Tile size="wide" label="Your machines" to="/fleet">
				{signedOut}
			</Tile>
		);
	const list = machines.data ?? [];
	// Eight wide tiles fit beside the new one; past that, the last opens all of them.
	const shown = list.length > 8 ? list.slice(0, 7) : list;
	return (
		<>
			{shown.map((machine) => (
				<Tile
					key={machine.machineId}
					size="wide"
					label={machine.name}
					to={`/machines/${machine.machineId}`}
				>
					<Line
						name={
							machine.kind === followingRange.kind
								? "Range finder"
								: sentence(machine.kind.replace(/_/g, " "))
						}
					>
						{machine.name}
						<span className="block text-[14px] text-neutral-400">
							{sentence(machine.state)} · {machine.result.trades} trades ·{" "}
							{amount(machine.result.realised)} USDC
						</span>
					</Line>
				</Tile>
			))}
			{list.length > 8 ? (
				<Tile size="wide" label="All machines" to="/fleet">
					<Line name="All machines">{list.length} machines</Line>
				</Tile>
			) : null}
			<Tile size="wide" label="New machine" to="/new">
				<Line name="New machine">Give a machine a job</Line>
			</Tile>
		</>
	);
}

/** Activity: what your machines did, at a glance. The whole of it opens as its own screen. */
function ActivityTilesSignedIn() {
	const signedIn = useSignedIn();
	const feed = useActivity();
	const now = Date.now();
	const since = (ms: number) => feed.filter((entry) => now - Date.parse(entry.occurredAt) < ms);
	const week = since(7 * DAY);
	const count = (type: string) => week.filter((entry) => entry.type === type).length;
	const busiest = Object.entries(
		week.reduce<Record<string, number>>((tally, entry) => {
			tally[entry.machineName] = (tally[entry.machineName] ?? 0) + 1;
			return tally;
		}, {}),
	).sort((a, b) => b[1] - a[1])[0];
	const latest = feed[0];

	if (!signedIn)
		return (
			<Tile size="large" label="Recent activity" to="/feed">
				{signedOut}
			</Tile>
		);
	return (
		<>
			<Tile size="large" label="Recent activity" to="/feed">
				{feed.length ? (
					<div className="flex h-full flex-col justify-between p-4">
						<ul className="flex flex-col gap-2.5">
							{feed.slice(0, 5).map((entry) => (
								<li key={entry.id} className="flex flex-col">
									<span className="truncate text-[15px] text-neutral-100">
										{sentence(describeEvent(entry).title)} · {entry.machineName}
									</span>
									<span className="text-[12px] text-neutral-500">{when(entry.occurredAt)}</span>
								</li>
							))}
						</ul>
						<span className="text-[13px] text-neutral-500">Recent activity</span>
					</div>
				) : (
					<TileEmpty>Nothing has happened yet.</TileEmpty>
				)}
			</Tile>
			<Tile label="Today" to="/feed">
				<Figure value={since(DAY).length} note="events" name="Today" />
			</Tile>
			<Tile label="Trades this week" to="/trades">
				<Figure value={count("trade.completed")} note="this week" name="Trades" />
			</Tile>
			<Tile size="wide" label="Busiest machine" to="/feed">
				{busiest ? (
					<Line name="Busiest this week">
						{busiest[0]}
						<span className="block text-[14px] text-neutral-400">{busiest[1]} events</span>
					</Line>
				) : (
					<TileEmpty>Quiet this week.</TileEmpty>
				)}
			</Tile>
			<Tile label="Refusals" to="/feed">
				<Figure value={count("trade.refused")} note="this week" name="Refused" />
			</Tile>
			<Tile label="Failures" to="/feed">
				<Figure value={count("trade.failed")} note="this week" name="Failed" />
			</Tile>
			<Tile size="wide" label="Last heard" to="/feed">
				{latest ? (
					<Line name="Last heard">
						{when(latest.occurredAt)}
						<span className="block text-[14px] text-neutral-400">{latest.machineName}</span>
					</Line>
				) : (
					<TileEmpty>Nothing yet.</TileEmpty>
				)}
			</Tile>
			<Tile size="wide" label="Trades" to="/trades">
				<Line name="Trades">Every trade</Line>
			</Tile>
			<Tile size="wide" label="Decisions" to="/decisions">
				<Line name="Decisions">Every decision, and why</Line>
			</Tile>
			<Tile size="wide" label="Export" to="/feed">
				<Line name="Export">The whole record, as a spreadsheet</Line>
			</Tile>
		</>
	);
}

/** Insights: how your machine is really doing, worked out from its own record. */
function InsightsTilesSignedIn() {
	const signedIn = useSignedIn();
	const { machine, record } = useMachineAtWork();
	const day = useSolDay();
	if (!signedIn)
		return (
			<Tile size="big" label="Notes" to="/manager">
				{signedOut}
			</Tile>
		);
	if (!machine)
		return (
			<Tile size="big" label="Notes" to="/manager">
				<TileEmpty>Insights appear once you have a machine.</TileEmpty>
			</Tile>
		);
	const chronological = [...record].reverse();
	const notes = briefOn(machine, record, day?.last);
	const execution = executionBps(chronological);
	const holding = holdingReturn(chronological, day?.last);
	const rounds = machine.result.roundTrips;
	return (
		<>
			<Tile size="big" label="Notes" to={`/machines/${machine.machineId}`}>
				<div className="flex h-full flex-col justify-between p-5">
					<ul className="flex flex-col gap-3">
						{(notes.length ? notes : [{ level: "note" as const, text: "Nothing to say yet." }])
							.slice(0, 4)
							.map((note) => (
								<li
									key={note.text}
									className={`font-display text-[clamp(15px,3cqw,20px)] leading-snug ${note.level === "watch" ? "text-neutral-100" : "text-neutral-300"}`}
								>
									{sentence(note.text)}
								</li>
							))}
					</ul>
					<span className="text-[13px] text-neutral-500">Notes on {machine.name}</span>
				</div>
			</Tile>
			<Tile size="wide" label="Execution" to="/profit">
				<Figure
					value={
						execution === undefined ? "-" : `${execution >= 0 ? "+" : ""}${execution.toFixed(1)}`
					}
					note="basis points against the quote"
					name="Execution"
				/>
			</Tile>
			<Tile size="wide" label="Against holding" to="/profit">
				<Figure
					value={
						holding === undefined ? "-" : `${holding >= 0 ? "+" : ""}${(holding * 100).toFixed(2)}%`
					}
					note="had it just held since its first buy"
					name="Against holding"
				/>
			</Tile>
			<Tile size="wide" label="Largest drop" to="/profit">
				<Figure
					value={amount(largestDrop(chronological).toString())}
					note="USDC, from its best"
					name="Largest drop"
				/>
			</Tile>
			<Tile size="wide" label="Win rate" to="/profit">
				<Figure
					value={rounds ? `${Math.round((machine.result.wins / rounds) * 100)}%` : "-"}
					note={`${machine.result.wins} of ${rounds} round trips`}
					name="Win rate"
				/>
			</Tile>
			<Tile size="wide" label="Fees" to="/profit">
				<Figure
					value={(Number(machine.result.feesLamports) / 1e9).toFixed(4)}
					note="SOL in network fees"
					name="Fees"
				/>
			</Tile>
		</>
	);
}

/** Swap: a live quote, and the swaps that are machines. */
export function SwapTiles() {
	const day = useSolDay();
	const [from, setFrom] = useState<Token>("USDC");
	const [typed, setTyped] = useState("10");
	const [amountIn, setAmountIn] = useState(10);
	const to: Token = from === "USDC" ? "SOL" : "USDC";
	useEffect(() => {
		const timer = setTimeout(() => {
			const read = Number(typed);
			setAmountIn(Number.isFinite(read) && read > 0 ? read : 0);
		}, 400);
		return () => clearTimeout(timer);
	}, [typed]);
	const quote = useQuery({
		queryKey: ["quote", from, to, amountIn],
		queryFn: () => fetchQuote(from, to, amountIn),
		enabled: amountIn > 0,
		refetchInterval: 10_000,
		retry: false,
	});
	return (
		<>
			<Tile size="big" label="Swap">
				<div data-own-drag className="flex h-full flex-col justify-between gap-4 p-5">
					<div className="flex flex-col gap-3">
						<label className="flex items-baseline justify-between gap-4 bg-white/[0.06] px-4 py-3">
							<span className="text-[13px] text-neutral-500">You pay</span>
							<input
								value={typed}
								onChange={(event) => setTyped(event.target.value)}
								inputMode="decimal"
								aria-label="You pay"
								className="min-w-0 flex-1 bg-transparent text-right font-display text-[26px] text-neutral-100 tabular-nums outline-none"
							/>
							<span className="text-[15px] text-neutral-300">{from}</span>
						</label>
						<button
							type="button"
							onClick={() => setFrom(to)}
							className="self-center text-[13px] text-neutral-400 hover:text-neutral-100"
						>
							Turn it around
						</button>
						<div className="flex items-baseline justify-between gap-4 bg-white/[0.06] px-4 py-3">
							<span className="text-[13px] text-neutral-500">You get</span>
							<span className="font-display text-[26px] text-neutral-100 tabular-nums">
								{quote.data ? quote.data.out.toFixed(to === "SOL" ? 5 : 2) : "-"}
							</span>
							<span className="text-[15px] text-neutral-300">{to}</span>
						</div>
					</div>
					<div className="flex flex-col gap-1 text-[13px] text-neutral-500">
						{quote.data ? (
							<>
								<span>
									Route: {quote.data.route.join(" → ") || "direct"} · price impact{" "}
									{quote.data.impactPct.toFixed(2)}%
								</span>
								<span>
									At least {quote.data.atLeast.toFixed(to === "SOL" ? 5 : 2)} {to} after slippage
								</span>
							</>
						) : quote.isError ? (
							<span>{quote.error.message}</span>
						) : null}
						<span>Quotes are live from Jupiter. Swapping from your wallet is next.</span>
					</div>
				</div>
			</Tile>
			<Tile size="wide" label="SOL price" to="/market/sol">
				{day ? (
					<Figure
						value={day.last.toFixed(2)}
						note={`${day.changePct >= 0 ? "▲" : "▼"} ${Math.abs(day.changePct).toFixed(2)}% today`}
						name="SOL"
					/>
				) : (
					<TileLoading />
				)}
			</Tile>
			<Tile size="wide" label="Limit order" to="/new">
				<Line name="Limit order">
					Buy when it falls to a price
					<span className="block text-[14px] text-neutral-400">A machine that waits for you</span>
				</Line>
			</Tile>
			<Tile size="wide" label="Recurring buy" to="/new">
				<Line name="Recurring buy">
					Buy a little, every day or week
					<span className="block text-[14px] text-neutral-400">A machine on a schedule</span>
				</Line>
			</Tile>
			<Tile size="wide" label="SOL today" to="/market/sol">
				{day ? (
					<Line name="SOL today">
						{day.low.toFixed(2)} to {day.high.toFixed(2)}
						<span className="block text-[14px] text-neutral-400">The day's range</span>
					</Line>
				) : (
					<TileLoading />
				)}
			</Tile>
			<Tile size="wide" label="Trades on the market" to="/market/sol">
				<div className="flex h-full flex-col justify-between gap-2 p-4">
					<div data-own-drag className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
						<Tape />
					</div>
					<span className="text-[13px] text-neutral-500">Trades on the market</span>
				</div>
			</Tile>
		</>
	);
}

/** Marketplace: the kinds of machine there are, and what each earns from. */
export function MarketplaceTiles() {
	return (
		<>
			{KIND_CARDS.map((kind) => (
				<Tile key={kind.id} size="wide" label={kind.name} {...(kind.ready ? { to: "/new" } : {})}>
					<Line name={kind.ready ? "Ready" : "Coming"}>
						{sentence(kind.name)}
						<span className="block text-[14px] text-neutral-400">
							Earns from {kind.earns.toLowerCase()}
						</span>
					</Line>
				</Tile>
			))}
			<Tile size="wide" label="Copy a machine" to="/marketplace/copy">
				<Line name="Coming">
					Copy someone's machine
					<span className="block text-[14px] text-neutral-400">
						Their recipe, your wallet, your limits
					</span>
				</Line>
			</Tile>
		</>
	);
}

/** Your own data once you are signed in; a grid asking you to connect until then. */
export function PortfolioTiles() {
	return useSignedIn() ? <PortfolioTilesSignedIn /> : <SignedOutGrid />;
}

/** Your own data once you are signed in; a grid asking you to connect until then. */
export function MachinesTiles() {
	return useSignedIn() ? <MachinesTilesSignedIn /> : <SignedOutGrid />;
}

/** Your own data once you are signed in; a grid asking you to connect until then. */
export function ActivityTiles() {
	return useSignedIn() ? <ActivityTilesSignedIn /> : <SignedOutGrid />;
}

/** Your own data once you are signed in; a grid asking you to connect until then. */
export function InsightsTiles() {
	return useSignedIn() ? <InsightsTilesSignedIn /> : <SignedOutGrid />;
}
