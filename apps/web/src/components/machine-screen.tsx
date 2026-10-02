import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { describeEvent } from "../lib/describe.ts";
import {
	ApiError,
	amount,
	holdingOf,
	type MachineAction,
	useBalances,
	useFund,
	useMachine,
	useMachineAction,
	useRecord,
	useWithdrawEverything,
} from "../lib/machines.ts";
import { numberFrom, sixDecimals } from "../lib/range-form.ts";
import { bandOf, statusOf } from "../lib/status.ts";
import { toast } from "../lib/toasts.ts";
import { sendTransaction } from "../lib/wallet.ts";
import { Tile, TileEmpty, TileLoading, TileProblem } from "./bento.tsx";
import { openEdge } from "./edges.tsx";
import { Line, sentence } from "./home.tsx";
import { SessionEnded } from "./system.tsx";

/**
 * One machine, on its own screen: what it is doing, its band, its money, everything it has done, and
 * the controls. The record is the one tile that scrolls, inside itself; the screen never does.
 */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DONE: Record<MachineAction, string> = {
	fund: "Funded",
	start: "Started",
	pause: "Paused",
	resume: "Resumed",
	stop: "Stopped",
};
const ACTION =
	"w-full bg-white/[0.08] px-4 py-3 text-left font-display text-[15px] text-neutral-100 transition-colors hover:bg-white/[0.14] disabled:opacity-40";

/** SOL sent along for a machine's network fees: enough for a few hundred trades. */
const FEE_LAMPORTS = "12000000";

/** What funding sends, from what was typed. Nothing, when there is nothing to send. */
export function fundAmounts(typed: string, withSol: boolean) {
	const dollars = numberFrom(typed);
	const usdc = Number.isFinite(dollars) && dollars > 0 ? sixDecimals(typed) : "0";
	const lamports = withSol ? FEE_LAMPORTS : "0";
	return usdc === "0" && lamports === "0" ? undefined : { usdc, lamports };
}

/**
 * Funding from the owner's own wallet, in one approval: type the dollars, approve once, and the machine
 * has them, with a little SOL for its fees. Its address stays underneath, for sending from anywhere else.
 */
function Fund({
	machineId,
	walletAddress,
	granted,
}: {
	machineId: string;
	walletAddress: string;
	granted: string;
}) {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const fund = useFund(api, queryClient, machineId, sendTransaction);
	const [typed, setTyped] = useState("");
	const [withSol, setWithSol] = useState(true);
	const amounts = fundAmounts(typed, withSol);
	return (
		<div className="flex flex-col gap-1.5">
			<label className="flex items-center justify-between gap-3 bg-white/[0.06] px-3 py-2">
				<span className="text-[13px] text-neutral-500">Add</span>
				<input
					value={typed}
					onChange={(event) => setTyped(event.target.value)}
					inputMode="decimal"
					placeholder="40"
					aria-label="Dollars to add"
					className="min-w-0 flex-1 bg-transparent text-right font-display text-[18px] text-neutral-100 tabular-nums outline-none placeholder:text-neutral-600"
				/>
				<span className="text-[14px] text-neutral-400">USDC</span>
			</label>
			<button
				type="button"
				aria-pressed={withSol}
				onClick={() => setWithSol((was) => !was)}
				className="text-left text-[13px] text-neutral-400 hover:text-neutral-100"
			>
				{withSol ? "With 0.012 SOL for fees" : "No SOL for fees"}
			</button>
			<button
				type="button"
				disabled={!amounts || fund.isPending}
				onClick={() => {
					if (!amounts) return;
					fund.mutate(
						{ ...amounts, granted },
						{
							onSuccess: () => {
								setTyped("");
								toast("Funded from your wallet");
							},
							onError: (error) => toast(error.message, "problem"),
						},
					);
				}}
				className="w-full bg-white px-4 py-3 font-display text-[15px] text-neutral-950 transition-opacity disabled:opacity-30"
			>
				{fund.isPending ? "Approve in your wallet" : "Fund from my wallet"}
			</button>
			<button
				type="button"
				onClick={() => {
					void navigator.clipboard?.writeText(walletAddress);
					toast("Wallet address copied");
				}}
				className="truncate text-left font-mono text-[11px] text-neutral-500 hover:text-neutral-200"
				title="Copy its wallet address"
			>
				{walletAddress}
			</button>
		</div>
	);
}

export function MachineScreen({ machineId }: { machineId: string }) {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const machine = useMachine(api, machineId);
	const record = useRecord(api, machineId);
	const balances = useBalances(api, machineId);
	const act = useMachineAction(api, queryClient, machineId);
	const withdraw = useWithdrawEverything(api, queryClient, machineId);
	// Stopping and withdrawing ask once more, in place, rather than in a box.
	const [asking, setAsking] = useState<"stop" | "withdraw">();

	if (machine.error instanceof ApiError && machine.error.status === 401) {
		return <SessionEnded onConnect={() => openEdge("account")} />;
	}
	if (machine.error instanceof ApiError && [403, 404].includes(machine.error.status)) {
		return (
			<Tile size="wide" label="Not found">
				<TileEmpty>This machine is not yours, or does not exist.</TileEmpty>
			</Tile>
		);
	}
	if (machine.error) {
		return (
			<Tile size="wide" label="Problem">
				<TileProblem retry={() => void machine.refetch()}>{machine.error.message}</TileProblem>
			</Tile>
		);
	}
	const detail = machine.data;
	if (!detail) {
		return (
			<Tile size="wide" label="Loading">
				<TileLoading />
			</Tile>
		);
	}

	const events = record.data ?? [];
	const levels = bandOf(detail, events);
	const run = (action: MachineAction) =>
		act.mutate(
			{ action },
			{
				onSuccess: () => toast(`${DONE[action]} ${detail.name}`),
				onError: (error) => toast(error.message, "problem"),
			},
		);
	const controls = detail.actions.filter((action) => action !== "fund" && action !== "stop");
	const settled = ["draft", "ready", "paused", "stopped"].includes(detail.state);

	return (
		<>
			<Tile size="wide" label="Status">
				<Line name={`${detail.name} · ${sentence(detail.state)}`}>
					{sentence(statusOf(detail, events))}
				</Line>
			</Tile>

			<Tile size="wide" label="Band">
				{levels.length ? (
					<div className="flex h-full flex-col justify-between p-4">
						<ul className="flex flex-col gap-1.5">
							{levels.map((level) => (
								<li
									key={level.label}
									className="flex items-baseline justify-between font-display text-[18px] text-neutral-100 tabular-nums"
								>
									<span className="text-[14px] text-neutral-400">{sentence(level.label)}</span>
									{level.price.toFixed(2)}
								</li>
							))}
						</ul>
						<span className="text-[13px] text-neutral-500">Band</span>
					</div>
				) : (
					<TileEmpty>No band set.</TileEmpty>
				)}
			</Tile>

			<Tile size="wide" label="Money">
				<div className="flex h-full flex-col justify-between p-4">
					<ul className="flex flex-col gap-1 text-[15px] text-neutral-300 tabular-nums">
						<li>
							<span className="font-display text-[22px] text-neutral-100">
								{amount(detail.result.realised)}
							</span>{" "}
							USDC realised
						</li>
						<li>{amount(detail.result.position, 9)} SOL holding</li>
						{balances.data?.vault ? (
							<li>{holdingOf(balances.data.vault, USDC).toFixed(2)} USDC in the vault</li>
						) : null}
					</ul>
					<span className="text-[13px] text-neutral-500">Money</span>
				</div>
			</Tile>

			<Tile size="big" label="Record">
				{events.length ? (
					<div className="flex h-full flex-col">
						{/* The one place anything scrolls: inside this tile, never the screen. */}
						<ol data-own-drag className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
							{events.map((entry) => {
								const said = describeEvent(entry);
								return (
									<li
										key={entry.id}
										className="grid grid-cols-[auto_1fr] gap-x-5 border-white/[0.06] border-b py-2.5"
									>
										<time
											className="text-[13px] text-neutral-500 tabular-nums"
											dateTime={entry.occurredAt}
										>
											{new Date(entry.occurredAt).toLocaleString([], {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</time>
										<span className="truncate text-[15px] text-neutral-100">
											{sentence(said.title)}
											{said.detail ? (
												<span className="text-neutral-500"> · {sentence(said.detail)}</span>
											) : null}
										</span>
									</li>
								);
							})}
						</ol>
						<span className="px-4 pb-4 text-[13px] text-neutral-500">
							Record · {events.length} entries
						</span>
					</div>
				) : (
					<TileEmpty>Nothing recorded yet.</TileEmpty>
				)}
			</Tile>

			<Tile size="large" label="Controls">
				<div className="flex h-full flex-col justify-between gap-3 p-4">
					<div className="flex flex-col gap-1.5">
						{controls.map((action) => (
							<button
								key={action}
								type="button"
								disabled={act.isPending}
								onClick={() => run(action)}
								className={ACTION}
							>
								{sentence(action)}
							</button>
						))}
						{detail.actions.includes("stop") ? (
							<button
								type="button"
								disabled={act.isPending}
								onClick={() => {
									if (asking !== "stop") return setAsking("stop");
									setAsking(undefined);
									run("stop");
								}}
								className={ACTION}
							>
								{asking === "stop" ? "Press again: it will never act again" : "Stop"}
							</button>
						) : null}
						{settled ? (
							<button
								type="button"
								disabled={withdraw.isPending}
								onClick={() => {
									if (asking !== "withdraw") return setAsking("withdraw");
									setAsking(undefined);
									withdraw.mutate(undefined, {
										onSuccess: (result) =>
											result.status === "sent"
												? toast("Everything is on its way to your wallet")
												: toast(`Withdrawal refused: ${result.reason}`, "problem"),
										onError: (error) => toast(error.message, "problem"),
									});
								}}
								className={ACTION}
							>
								{asking === "withdraw"
									? "Press again: everything back to your wallet"
									: "Withdraw everything"}
							</button>
						) : null}
					</div>
					{/* A paper machine trades no money, so there is nothing to fund; a stopped one never acts again. */}
					{detail.paper || detail.state === "stopped" ? (
						<span className="text-[13px] text-neutral-500">
							{detail.paper ? "On paper: nothing to fund." : "Stopped."}
						</span>
					) : (
						<Fund
							machineId={detail.machineId}
							walletAddress={detail.walletAddress}
							granted={detail.budget.granted}
						/>
					)}
				</div>
			</Tile>
		</>
	);
}
