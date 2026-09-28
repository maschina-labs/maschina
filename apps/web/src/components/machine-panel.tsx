import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { describeEvent } from "../lib/describe.ts";
import {
	ApiError,
	amount,
	holdingOf,
	type MachineAction,
	type MachineBalances,
	type MachineDetail,
	type RecordEntry,
	useBalances,
	useMachine,
	useMachineAction,
	useRecord,
	useWithdrawEverything,
} from "../lib/machines.ts";
import { fetchPrice } from "../lib/price.ts";
import { bandOf, statusOf } from "../lib/status.ts";
import { toast } from "../lib/toasts.ts";
import { executionBps, holdingReturn, largestDrop } from "../lib/track-record.ts";
import { BandDial } from "./band-dial.tsx";
import { Confirm } from "./confirm.tsx";
import { Loading } from "./loading.tsx";
import { ResultCard } from "./result-card.tsx";
import { TypeRow } from "./slider-row.tsx";
import { NotYours, SessionEnded } from "./status-pages.tsx";

/** A withdrawal only goes through once a machine has stopped acting, so it is only offered then. */
const SETTLED = new Set(["draft", "ready", "paused", "stopped"]);

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";

/** One cell of the grid: a small label and whatever it holds. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex min-h-[132px] flex-col gap-4 border-white/[0.07] border-t p-4 sm:border-l">
			<span className={LABEL}>{label}</span>
			{children}
		</div>
	);
}

/** The float as a row of thin segments: lit for what is in play, dim for what is waiting. */
function FloatBar({ granted, available }: { granted: string; available: string }) {
	const total = BigInt(granted);
	const inPlay = total - BigInt(available);
	const lit = total > 0n ? Number((inPlay * 40n) / total) : 0;
	return (
		<div className="flex flex-col gap-2">
			<div className="flex h-6 gap-[3px]" aria-hidden="true">
				{Array.from({ length: 40 }, (_, index) => (
					<span
						key={index}
						className={`w-full ${index < lit ? "bg-neutral-100" : "bg-white/12"}`}
					/>
				))}
			</div>
			<div className="flex justify-between text-[11px] text-neutral-400 tabular-nums">
				<span className="text-neutral-100">{amount(inPlay.toString())} IN PLAY</span>
				<span>OF {amount(granted)} USDC</span>
			</div>
		</div>
	);
}

function Big({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-[26px] text-neutral-100 tabular-nums">{value}</span>
			<span className={LABEL}>{label}</span>
		</div>
	);
}

const SMALL =
	"text-[10.5px] text-neutral-400 tracking-[0.14em] transition-colors hover:text-neutral-100";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** The tokens machines trade, by the name people know them by. */
const SYMBOLS: Record<string, string> = {
	EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
	So11111111111111111111111111111111111111112: "SOL",
};

export function MachinePanelView({
	machine,
	record,
	price,
	balances,
	busy,
	onAction,
	onWithdraw,
}: {
	machine: MachineDetail;
	record: RecordEntry[];
	/** What it holds on chain right now, when that has been read. */
	balances?: MachineBalances | undefined;
	/** The live SOL price, when there is one, for the band meter. */
	price?: number | undefined;
	busy: boolean;
	onAction: (action: MachineAction) => void;
	onWithdraw: () => void;
}) {
	const settings = machine.settings;
	const buy =
		typeof settings["buyLevel"] === "string" ? Number(settings["buyLevel"]) / 1_000_000 : undefined;
	const sell =
		typeof settings["sellLevel"] === "string"
			? Number(settings["sellLevel"]) / 1_000_000
			: undefined;
	// Every level it is watching, for a band that moves and so has no fixed edges to read.
	const levels = bandOf(machine, record);
	// What is on chain. The SOL it keeps for fees is what it holds beyond the SOL its trades bought.
	const walletSol = balances ? Number(balances.wallet.lamports) / 1e9 : undefined;
	const feeSol =
		walletSol === undefined
			? undefined
			: Math.max(walletSol - Number(machine.result.position) / 1e9, 0);
	const controls = machine.actions.filter((action) => action !== "fund");
	// Anything that stops a machine or moves its money is asked about first.
	const [asking, setAsking] = useState<MachineAction | "withdraw">();
	const [renaming, setRenaming] = useState(false);
	const [sharing, setSharing] = useState(false);
	const [newName, setNewName] = useState(machine.name);
	const name = machine.name.toUpperCase();
	// The record arrives newest first; the track record reads it oldest first, as it happened.
	const chronological = [...record].reverse();
	const execution = executionBps(chronological);
	const holding = holdingReturn(chronological, price);
	const questions: Partial<
		Record<MachineAction | "withdraw", { lines: string[]; confirm: string }>
	> = {
		pause: {
			lines: ["IT STOPS ACTING UNTIL YOU RESUME IT.", "WHAT IT HOLDS STAYS WHERE IT IS."],
			confirm: "PAUSE",
		},
		stop: {
			lines: ["IT WILL NEVER ACT AGAIN.", "ITS MONEY STAYS IN ITS WALLET UNTIL YOU WITHDRAW IT."],
			confirm: "STOP",
		},
		withdraw: {
			lines: [
				"EVERY TOKEN AND ALL THE SOL, FROM ITS WALLET AND ITS VAULT, GO BACK TO YOUR WALLET.",
				"IT CAN ONLY EVER SEND TO YOU.",
			],
			confirm: "WITHDRAW",
		},
	};
	const press = (action: MachineAction | "withdraw") => {
		if (questions[action]) return setAsking(action);
		if (action !== "withdraw") onAction(action);
	};
	const asked = asking ? questions[asking] : undefined;
	const button =
		"h-9 w-full border border-white/25 text-[11px] text-neutral-100 tracking-[0.14em] transition-colors hover:bg-white/[0.06] disabled:opacity-40";
	return (
		<article aria-label={machine.name} className="flex flex-col gap-8">
			<header className="flex flex-wrap items-baseline justify-between gap-4">
				<h1 className="text-[20px] text-neutral-100 tracking-[0.08em]">
					{machine.name.toUpperCase()}
				</h1>
				<div className="flex items-center gap-4">
					<span className={LABEL}>
						{machine.kind.toUpperCase()} · {machine.state.toUpperCase()}
					</span>
					<button type="button" onClick={() => setRenaming((was) => !was)} className={SMALL}>
						RENAME
					</button>
					<button
						type="button"
						onClick={() => {
							void navigator.clipboard?.writeText(
								`${window.location.origin}/machines/${machine.machineId}`,
							);
							toast("link copied");
						}}
						className={SMALL}
					>
						COPY LINK
					</button>
					<button type="button" onClick={() => setSharing(true)} className={SMALL}>
						SHARE
					</button>
				</div>
			</header>
			{renaming ? (
				<div className="flex flex-col gap-1.5">
					<TypeRow label="NEW NAME" value={newName} onChange={setNewName} />
					<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
						RENAMING, AND RETUNING A MACHINE WITHOUT MAKING A NEW ONE, ARRIVE WITH THE BACKEND PASS.
						BOTH WILL BE RECORDED IN ITS HISTORY.
					</p>
				</div>
			) : null}

			<div className="grid border-white/[0.07] border-r border-b sm:grid-cols-3">
				<Cell label="STATUS">
					<span className="text-[15px] text-neutral-100">{statusOf(machine, record)}</span>
				</Cell>
				<Cell label="BAND">
					{buy !== undefined && sell !== undefined ? (
						<div className="mx-auto aspect-square w-full max-w-[240px]">
							<BandDial buy={buy} sell={sell} price={price} />
						</div>
					) : (
						<div className="flex flex-col gap-2 text-[15px] text-neutral-100 tabular-nums">
							{levels.map((level) => (
								<span key={level.label}>{`${level.label} ${level.price.toFixed(2)}`}</span>
							))}
						</div>
					)}
				</Cell>
				<Cell label="FLOAT">
					<FloatBar granted={machine.budget.granted} available={machine.budget.available} />
				</Cell>
				<Cell label="RESULTS">
					<div className="flex gap-8">
						<Big label="TRADES" value={String(machine.result.trades)} />
						<Big label="WINS" value={String(machine.result.wins)} />
						<Big label="LOSSES" value={String(machine.result.losses)} />
					</div>
				</Cell>
				<Cell label="MONEY">
					<div className="flex flex-col gap-2 text-[12px] tabular-nums">
						<span className="text-neutral-100">
							REALISED {amount(machine.result.realised)} USDC
						</span>
						<span className="text-neutral-400">
							HOLDING {amount(machine.result.position, 9)} SOL
						</span>
						{balances ? (
							<span className="text-neutral-400">
								{`IN ITS WALLET ${holdingOf(balances.wallet, USDC).toFixed(2)} USDC · ${(walletSol ?? 0).toFixed(4)} SOL`}
							</span>
						) : null}
						{typeof settings["amountPerBuy"] === "string" ? (
							<span className="text-neutral-400">
								EACH BUY {amount(settings["amountPerBuy"])} USDC
							</span>
						) : null}
						<span className="break-all text-[10.5px] text-neutral-500">
							{machine.walletAddress}
						</span>
					</div>
				</Cell>
				<Cell label="ACTIONS">
					<div className="flex flex-col gap-2">
						{controls.map((action) => (
							<button
								key={action}
								type="button"
								disabled={busy}
								onClick={() => press(action)}
								className={button}
							>
								{action.toUpperCase()}
							</button>
						))}
						{SETTLED.has(machine.state) ? (
							<button
								type="button"
								disabled={busy}
								onClick={() => press("withdraw")}
								className={button}
							>
								WITHDRAW EVERYTHING
							</button>
						) : null}
					</div>
				</Cell>
			</div>

			<div className="grid border-white/[0.07] border-r border-b sm:grid-cols-3">
				<Cell label="TRACK RECORD">
					<div className="flex flex-col gap-2 text-[12px] tabular-nums">
						<span className="text-neutral-100">
							LARGEST DROP {amount(largestDrop(chronological).toString())} USDC
						</span>
						<span className="text-neutral-400">
							EXECUTION{" "}
							{execution === undefined
								? "-"
								: `${execution >= 0 ? "+" : ""}${execution.toFixed(1)} BPS VS QUOTE`}
						</span>
						<span className="text-neutral-400">
							JUST HOLDING{" "}
							{holding === undefined
								? "-"
								: `${holding >= 0 ? "+" : ""}${(holding * 100).toFixed(2)}% SINCE ITS FIRST BUY`}
						</span>
					</div>
				</Cell>
				<Cell label="LIMITS">
					<div className="flex flex-col gap-2 text-[12px] tabular-nums">
						<span className="text-neutral-100">BUDGET {amount(machine.budget.granted)} USDC</span>
						<span className="text-neutral-400">
							FEES{" "}
							{machine.result.simulated
								? "NONE, IT IS ON PAPER"
								: "A MONTHLY FEE AND A SHARE PER TRADE, SET WITH BILLING"}
						</span>
						{machine.limits.maxPerTrade ? (
							<span className="text-neutral-400">
								PER TRADE {amount(machine.limits.maxPerTrade)}
							</span>
						) : null}
						{machine.limits.maxPerDay ? (
							<span className="text-neutral-400">PER DAY {amount(machine.limits.maxPerDay)}</span>
						) : null}
						<span className="text-neutral-500">
							TRADES ONLY{" "}
							{machine.limits.approvedMints
								.map((mint) => SYMBOLS[mint] ?? `${mint.slice(0, 4)}…`)
								.join(" · ")}
						</span>
					</div>
				</Cell>
				<Cell label="VAULT">
					<div className="flex flex-col gap-2">
						<span
							className={`text-[26px] tabular-nums ${balances?.vault ? "text-neutral-100" : "text-neutral-500"}`}
						>
							{balances?.vault ? `${holdingOf(balances.vault, USDC).toFixed(2)} USDC` : "-"}
						</span>
						<span className="text-[10px] text-neutral-600 tracking-[0.1em]">
							PROFIT ABOVE THE FLOAT IS BANKED HERE, WHERE IT CAN NEVER BE TRADED.
						</span>
					</div>
				</Cell>
				<Cell label="FEE SOL">
					<div className="flex flex-col gap-2">
						<div className="flex h-4 items-end gap-[3px]" aria-hidden="true">
							{Array.from({ length: 24 }, (_, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: ticks never reorder
								<span key={index} className="block h-full w-px bg-white/12" />
							))}
						</div>
						{feeSol === undefined ? null : (
							<span className="text-[26px] text-neutral-100 tabular-nums">
								{feeSol.toFixed(4)} SOL
							</span>
						)}
						<span className="text-[10px] text-neutral-600 tracking-[0.1em]">
							{feeSol !== undefined && feeSol < 0.005
								? "RUNNING LOW. TOP IT UP WITH A LITTLE SOL OR IT CANNOT PAY FOR ITS NEXT TRADE."
								: "WHAT IT HOLDS TO PAY ITS OWN NETWORK FEES. IT WARNS YOU BELOW 0.005 SOL."}
						</span>
					</div>
				</Cell>
			</div>

			<section aria-label="Record" className="flex flex-col gap-3">
				<h2 className={LABEL}>RECORD</h2>
				<ol className="flex flex-col">
					{record.slice(0, 8).map((entry) => {
						const said = describeEvent(entry);
						return (
							<li
								key={entry.id}
								className="grid grid-cols-[auto_auto_1fr] gap-6 border-white/[0.06] border-b py-2.5 text-[11px] tracking-[0.1em]"
							>
								<time className="text-neutral-500 tabular-nums" dateTime={entry.occurredAt}>
									{new Date(entry.occurredAt).toLocaleString("en-CA", { hour12: false })}
								</time>
								<span className="text-neutral-100">{said.title}</span>
								<span className="truncate text-neutral-500">{said.detail}</span>
							</li>
						);
					})}
				</ol>
			</section>
			<section aria-label="Danger zone" className="flex flex-col gap-3 border border-white/15 p-4">
				<h2 className={LABEL}>DANGER ZONE</h2>
				<p className="text-[11px] text-neutral-400 leading-relaxed tracking-[0.08em]">
					RETIRING A STOPPED, EMPTY MACHINE DELETES ITS WALLET FOR GOOD. ANYTHING SENT TO THAT
					ADDRESS AFTERWARDS IS LOST, SO IT IS ONLY OFFERED ONCE BOTH ITS ACCOUNTS ARE EMPTY.
				</p>
				<button
					type="button"
					disabled
					className="h-9 self-start border border-white/20 px-4 text-[11px] text-neutral-300 tracking-[0.14em] disabled:opacity-40"
				>
					RETIRE THIS MACHINE
				</button>
				<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
					ARRIVES WITH THE BACKEND PASS
				</p>
			</section>

			{sharing ? (
				<ResultCard
					machine={machine}
					band={
						buy !== undefined && sell !== undefined
							? `${buy.toFixed(2)} TO ${sell.toFixed(2)}`
							: levels.map((level) => `${level.label} ${level.price.toFixed(2)}`).join(" · ") ||
								undefined
					}
					onClose={() => setSharing(false)}
				/>
			) : null}
			{asking && asked ? (
				<Confirm
					title={`${asked.confirm} ${name}?`}
					lines={asked.lines}
					confirm={asked.confirm}
					onCancel={() => setAsking(undefined)}
					onConfirm={() => {
						setAsking(undefined);
						if (asking === "withdraw") onWithdraw();
						else onAction(asking);
					}}
				/>
			) : null}
		</article>
	);
}

/** What each action reads as once it has happened. */
const DONE: Record<MachineAction, string> = {
	fund: "funded",
	start: "started",
	pause: "paused",
	resume: "resumed",
	stop: "stopped",
};

export function MachinePanel({ machineId }: { machineId: string }) {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const machine = useMachine(api, machineId);
	const record = useRecord(api, machineId);
	const balances = useBalances(api, machineId);
	const act = useMachineAction(api, queryClient, machineId);
	const withdraw = useWithdrawEverything(api, queryClient, machineId);
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});

	// Not yours and signed out get their own pages; anything else shows the real message.
	if (
		machine.error instanceof ApiError &&
		(machine.error.status === 403 || machine.error.status === 404)
	)
		return <NotYours />;
	if (machine.error instanceof ApiError && machine.error.status === 401) return <SessionEnded />;
	if (machine.error)
		return (
			<p role="alert" className="text-[12px] text-neutral-500">
				{machine.error.message}
			</p>
		);
	if (!machine.data) return <Loading what="LOADING THE MACHINE" />;
	return (
		<>
			<MachinePanelView
				machine={machine.data}
				record={record.data ?? []}
				price={price.data?.usd}
				balances={balances.data}
				busy={act.isPending || withdraw.isPending}
				onAction={(action) =>
					act.mutate(
						{ action },
						{
							onSuccess: () => toast(`${DONE[action]} · ${machine.data?.name ?? ""}`),
							onError: (error) => toast(error.message, "problem"),
						},
					)
				}
				onWithdraw={() =>
					withdraw.mutate(undefined, {
						onSuccess: (result) =>
							result.status === "sent"
								? toast("withdrawal sent to your wallet")
								: toast(`withdrawal refused · ${result.reason}`, "problem"),
						onError: (error) => toast(error.message, "problem"),
					})
				}
			/>
			{act.error || withdraw.error ? (
				<p role="alert" className="mt-3 text-[12px] text-neutral-400">
					{(act.error ?? withdraw.error)?.message}
				</p>
			) : null}
		</>
	);
}
