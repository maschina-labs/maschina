import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { describeEvent } from "../lib/describe.ts";
import { amount, holdingOf, useBalances, useMachines } from "../lib/machines.ts";
import { type Day, streamDay } from "../lib/market.ts";
import { totalsOf } from "../lib/portfolio.ts";
import { useSession } from "../lib/session.ts";
import { useSide } from "../lib/side.ts";
import { statusOf } from "../lib/status.ts";
import { tradesFrom } from "../lib/trades.ts";
import { bandOf, useMachineAtWork } from "./at-work.tsx";
import { Tile, TileEmpty, TileLoading } from "./bento.tsx";
import { PriceChart } from "./price-chart.tsx";
import { firstRunStep, StartHere } from "./start-here.tsx";

/**
 * Home: one tile, one job. Each shows a single figure or a single line, quiet, with its name small
 * beneath it, and the live ones change in place without a fuss.
 */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** The day's SOL figures, live from the exchange, shared by the tiles that need them. */
export function useSolDay(): Day | undefined {
	const [day, setDay] = useState<Day>();
	useEffect(() => streamDay("SOLUSDT", setDay), []);
	return day;
}

/** A figure, as large as the tile allows, and the tile's name small at its foot. */
export function Figure({
	value,
	note,
	name,
}: {
	value: ReactNode;
	note?: ReactNode;
	name: string;
}) {
	return (
		<div className="flex h-full flex-col justify-between p-4">
			<div className="flex flex-col gap-1">
				<span className="font-display text-[clamp(22px,15cqw,44px)] text-neutral-100 tabular-nums leading-none">
					{value}
				</span>
				{note ? <span className="text-[13px] text-neutral-400">{note}</span> : null}
			</div>
			<span className="text-[13px] text-neutral-500">{name}</span>
		</div>
	);
}

/** A line of words, for the wide tiles that say rather than count. */
export function Line({ children, name }: { children: ReactNode; name: string }) {
	return (
		<div className="flex h-full flex-col justify-between p-4">
			<div className="font-display text-[clamp(16px,5cqw,22px)] text-neutral-100 leading-snug">
				{children}
			</div>
			<span className="text-[13px] text-neutral-500">{name}</span>
		</div>
	);
}

const signedOut = <TileEmpty>Connect to see your machines.</TileEmpty>;

/** A line in sentence case: a capital at the start and nowhere else that shouts. */
export const sentence = (text: string) => {
	const lower = text.toLowerCase();
	return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export function HomeTiles() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const { machine, record } = useMachineAtWork();
	const balances = useBalances(api, machine?.machineId ?? "");
	const mine = session.data ? machines.data : [];
	const side = useSide();
	const totals = mine ? totalsOf(mine, side) : undefined;
	const latest = record[0];
	// Until a machine has started, the big tile on the left walks you through getting one going.
	const firstRun = firstRunStep({ signedIn: Boolean(session.data), machines: mine });

	return (
		<>
			{/*
			 * Six by three, filled exactly: the market wide on the left, your profit beside it,
			 * and along the bottom your machine, its latest decision, the vault and a new machine.
			 */}
			<Tile size="big" to="/market/sol" label="Chart">
				{/* The chart pans and zooms itself; gestures on it never swipe the page. */}
				<div data-own-drag className="absolute inset-x-2 top-2 bottom-10">
					<PriceChart
						interval="15m"
						history={96}
						levels={machine ? bandOf(machine, record) : []}
						trades={tradesFrom(record)}
					/>
				</div>
				{/* The chart keeps its own clicks; its name below opens the SOL screen. */}
				<span className="absolute bottom-4 left-4 text-[13px] text-neutral-500">SOL</span>
			</Tile>
			{firstRun ? (
				<Tile size="large" label="Start here">
					<StartHere at={firstRun} />
				</Tile>
			) : (
				<Tile size="large" to="/profit" label="Realized profit">
					{totals ? (
						<Figure value={amount(totals.realized.toString())} note="USDC" name="Realized" />
					) : (
						<TileLoading />
					)}
				</Tile>
			)}
			<Tile
				size="wide"
				label={machine?.name ?? "Your machine"}
				{...(machine ? { to: `/machines/${machine.machineId}` } : {})}
			>
				{!session.data ? (
					signedOut
				) : machine ? (
					<Line name={machine.name}>{sentence(statusOf(machine, record))}</Line>
				) : machines.data ? (
					<TileEmpty>No machine yet.</TileEmpty>
				) : (
					<TileLoading />
				)}
			</Tile>
			<Tile to="/decisions" size="wide" label="Latest decision">
				{!session.data ? (
					signedOut
				) : latest ? (
					<Line name="Latest decision">
						{sentence(describeEvent(latest).title)}
						<span className="block text-[14px] text-neutral-400">
							{sentence(describeEvent(latest).detail)}
						</span>
					</Line>
				) : (
					<TileEmpty>Nothing decided yet.</TileEmpty>
				)}
			</Tile>
			<Tile to="/vault" label="In the vault">
				{!session.data ? (
					signedOut
				) : balances.data?.vault ? (
					<Figure
						value={holdingOf(balances.data.vault, USDC).toFixed(2)}
						note="USDC, banked"
						name="Vault"
					/>
				) : balances.isError ? (
					<TileEmpty>Not readable here.</TileEmpty>
				) : (
					<TileLoading />
				)}
			</Tile>
			<Tile to="/new" label="New machine">
				<Line name="New machine">Give one a job</Line>
			</Tile>
		</>
	);
}
