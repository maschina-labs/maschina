/**
 * One machine, as a control surface.
 *
 * Read top to bottom it answers four questions in order: what is this, what is it allowed to spend, what
 * has it done, and what was it told to do. The record is the centre of the screen because the record is
 * the product's argument: everything a machine did is there, in order, with the numbers it used.
 *
 * Every event type is a fact rather than a mood. Only two get colour: a trade is blue because it is the
 * thing an owner is watching for, and a failure is red. A skipped run is the most common entry in a
 * healthy machine's record and is kept quiet on purpose.
 */

import {
	ArrowDown,
	ArrowSquareOut,
	ArrowUp,
	CheckCircle,
	Circle,
	Coin,
	HandCoins,
	type Icon,
	MinusCircle,
	Pause,
	PencilSimple,
	Play,
	Prohibit,
	Pulse,
	Receipt,
	SlidersHorizontal,
	Stop,
	WarningCircle,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ForError } from "../components/for-error.tsx";
import { Shell } from "../components/shell.tsx";
import {
	Button,
	Empty,
	Failed,
	Loading,
	Meter,
	Metric,
	PageHead,
	Panel,
	Payload,
	Pill,
	Row,
} from "../components/ui.tsx";
import {
	amount,
	type MachineAction,
	type RecordEntry,
	useMachine,
	useMachineAction,
	useRecord,
	useWithdrawEverything,
	type WithdrawnEverything,
} from "../lib/machines.ts";

export const Route = createFileRoute("/machines/$machineId")({
	component: Machine,
});

const ACTION: Record<MachineAction, { label: string; icon: Icon }> = {
	fund: { label: "Set budget", icon: Coin },
	start: { label: "Start", icon: Play },
	pause: { label: "Pause", icon: Pause },
	resume: { label: "Resume", icon: Play },
	stop: { label: "Stop", icon: Stop },
};

/** How each event reads: its glyph, the words for it, and whether it is worth colour. */
const EVENTS: Record<string, { icon: Icon; said: string; tone?: "live" | "danger" }> = {
	"machine.created": { icon: Circle, said: "made" },
	"machine.started": { icon: Play, said: "started" },
	"machine.paused": { icon: Pause, said: "paused" },
	"machine.resumed": { icon: Play, said: "resumed" },
	"machine.stopped": { icon: Stop, said: "stopped" },
	"machine.limits_changed": { icon: SlidersHorizontal, said: "limits changed" },
	"run.queued": { icon: Circle, said: "run queued" },
	"run.started": { icon: Play, said: "run started" },
	"run.skipped": { icon: MinusCircle, said: "run skipped" },
	"run.finished": { icon: CheckCircle, said: "run finished" },
	"trade.intended": { icon: ArrowUp, said: "trade intended", tone: "live" },
	"trade.simulated": { icon: Receipt, said: "trade simulated", tone: "live" },
	"trade.submitted": { icon: ArrowUp, said: "trade sent", tone: "live" },
	"trade.completed": { icon: ArrowDown, said: "trade done", tone: "live" },
	"trade.refused": { icon: Prohibit, said: "trade refused", tone: "danger" },
	"trade.failed": { icon: WarningCircle, said: "trade failed", tone: "danger" },
	"withdrawal.requested": { icon: ArrowUp, said: "withdrawal asked for" },
	"withdrawal.submitted": { icon: ArrowUp, said: "withdrawal sent" },
	"withdrawal.completed": { icon: CheckCircle, said: "withdrawal done" },
	"withdrawal.failed": { icon: WarningCircle, said: "withdrawal failed", tone: "danger" },
};

const at = (when: string) =>
	new Date(when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const on = (when: string) =>
	new Date(when).toLocaleDateString([], { day: "2-digit", month: "short" });

function Entry({ entry }: { entry: RecordEntry }) {
	const known = EVENTS[entry.type];
	const Glyph = known?.icon ?? Circle;
	const colour =
		known?.tone === "live"
			? "text-accent-text"
			: known?.tone === "danger"
				? "text-danger-text"
				: "text-text-faint";
	/** The one line of the payload worth reading without opening it. */
	const detail =
		(entry.payload["detail"] as string | undefined) ??
		(entry.payload["reason"] as string | undefined) ??
		undefined;

	return (
		<li className="flex gap-3 border-line/50 border-b px-4 py-2.5 last:border-0">
			<Glyph size={14} className={`mt-[2px] shrink-0 ${colour}`} />
			<div className="min-w-0 flex-1">
				<div className="flex items-baseline justify-between gap-3">
					<span className="truncate font-mono text-[12px] text-text">{entry.type}</span>
					<span className="shrink-0 font-mono text-[11px] text-text-faint">
						{on(entry.occurredAt)} {at(entry.occurredAt)}
					</span>
				</div>
				<p className="mt-0.5 text-[12px] text-text-muted">
					{known?.said ?? "recorded"}
					{detail ? <span className="text-text-faint"> · {detail}</span> : null}
				</p>
				<Payload value={entry.payload} />
			</div>
		</li>
	);
}

function Machine() {
	const { machineId } = Route.useParams();
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const machine = useMachine(api, machineId);
	const record = useRecord(api, machineId);
	const act = useMachineAction(api, queryClient, machineId);
	const withdraw = useWithdrawEverything(api, queryClient, machineId);
	const [confirming, setConfirming] = useState(false);
	const [budget, setBudget] = useState("");
	const [editing, setEditing] = useState(false);

	if (machine.isPending) {
		return (
			<Shell>
				<PageHead title="Loading" />
				<div className="mx-auto w-full max-w-[1180px] px-7 py-6">
					<Loading rows={5} />
				</div>
			</Shell>
		);
	}

	if (machine.error) {
		return (
			<Shell>
				<PageHead title="Machine" />
				<ForError
					error={machine.error}
					title="This machine could not be read"
					retry={() => machine.refetch()}
				/>
			</Shell>
		);
	}

	const it = machine.data;
	const live = it.state === "running";
	// Only a machine that has stopped acting can be emptied: a running one may have a trade in flight.
	const settled = it.state === "paused" || it.state === "stopped";
	const spendable = Number(it.budget.granted) / 1_000_000;

	return (
		<Shell>
			<PageHead
				title={it.name}
				actions={
					<>
						{it.actions.includes("fund") ? (
							<Button icon={Coin} onClick={() => setEditing(!editing)}>
								Set budget
							</Button>
						) : null}
						{it.actions
							.filter((action) => action !== "fund")
							.map((action) => (
								<Button
									key={action}
									icon={ACTION[action].icon}
									tone={action === "stop" ? "danger" : action === "start" ? "primary" : "outline"}
									disabled={act.isPending}
									onClick={() => act.mutate({ action })}
								>
									{ACTION[action].label}
								</Button>
							))}
						<Button
							icon={HandCoins}
							disabled={!settled || withdraw.isPending}
							title={settled ? undefined : "Pause or stop it first"}
							onClick={() => setConfirming(true)}
						>
							Withdraw everything
						</Button>
					</>
				}
			>
				<div className="mt-2 flex flex-wrap items-center gap-2">
					<Pill tone={live ? "live" : "quiet"} dot={live}>
						{it.state}
					</Pill>
					<Pill tone="quiet">{it.kind}</Pill>
					{it.result.simulated ? <Pill tone="neutral">on paper</Pill> : null}
					<span className="font-mono text-[11.5px] text-text-faint">{it.walletAddress}</span>
				</div>
				{it.stateReason ? (
					<p className="mt-2 text-[12px] text-text-muted">{it.stateReason}</p>
				) : null}
			</PageHead>

			<div className="mx-auto w-full max-w-[1180px] px-7 py-6">
				{editing ? (
					<div className="mb-5 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
						<Coin size={14} className="shrink-0 text-text-faint" />
						<input
							value={budget}
							onChange={(event) => setBudget(event.target.value)}
							placeholder="Total this machine may ever spend, in USDC"
							aria-label="Total budget in USDC"
							className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] outline-none placeholder:font-sans placeholder:text-text-faint"
						/>
						<Button
							tone="primary"
							disabled={act.isPending || !/^\d+(\.\d{1,6})?$/.test(budget)}
							onClick={() => {
								const base = BigInt(Math.round(Number(budget) * 1_000_000));
								act.mutate(
									{ action: "fund", budgetGranted: base.toString() },
									{
										onSuccess: () => {
											setBudget("");
											setEditing(false);
										},
									},
								);
							}}
						>
							Set
						</Button>
						<Button tone="quiet" onClick={() => setEditing(false)}>
							Cancel
						</Button>
					</div>
				) : null}

				{confirming ? (
					<div className="mb-5 rounded-lg border border-line bg-surface px-3.5 py-3">
						<p className="text-[12.5px] text-text">
							Every token and all the SOL in this machine, including what it banked in its vault,
							goes back to the wallet you signed in with. Nothing stays behind but what the last
							transfer costs to send.
						</p>
						<div className="mt-3 flex gap-2">
							<Button
								tone="primary"
								icon={HandCoins}
								disabled={withdraw.isPending}
								onClick={() =>
									withdraw.mutate(undefined, { onSettled: () => setConfirming(false) })
								}
							>
								{withdraw.isPending ? "Sending it home" : "Send it all to me"}
							</Button>
							<Button
								tone="quiet"
								disabled={withdraw.isPending}
								onClick={() => setConfirming(false)}
							>
								Cancel
							</Button>
						</div>
					</div>
				) : null}

				{withdraw.data ? <Withdrawn result={withdraw.data} /> : null}
				{withdraw.error ? (
					<p className="mb-5 rounded-md border border-danger/30 bg-danger-wash/40 px-3 py-2 font-mono text-[12px] text-danger-text">
						{withdraw.error.message}
					</p>
				) : null}

				{act.error ? (
					<p className="mb-5 rounded-md border border-danger/30 bg-danger-wash/40 px-3 py-2 font-mono text-[12px] text-danger-text">
						{act.error.message}
					</p>
				) : null}

				<div className="mb-5 rounded-lg border border-line bg-surface">
					<div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-4">
						<Metric label="Granted" value={amount(it.budget.granted)} unit="USDC" />
						<Metric label="Held" value={amount(it.budget.reserved)} tone="muted" />
						<Metric label="Spent" value={amount(it.budget.settled)} tone="accent" />
						<Metric label="Left" value={amount(it.budget.available)} />
					</div>
					<div className="px-4 pb-4">
						<Meter
							granted={spendable}
							held={Number(it.budget.reserved) / 1_000_000}
							spent={Number(it.budget.settled) / 1_000_000}
						/>
					</div>
					<div className="grid grid-cols-2 gap-x-6 gap-y-4 border-line border-t px-4 py-4 sm:grid-cols-4">
						<Metric
							label="Made"
							value={amount(it.result.realised)}
							unit="USDC"
							tone={
								it.result.realised.startsWith("-")
									? "danger"
									: it.result.realised === "0"
										? "muted"
										: "accent"
							}
						/>
						<Metric label="Holding" value={amount(it.result.position, 9)} unit="SOL" tone="muted" />
						<Metric
							label={`Round trips · ${it.result.wins} up, ${it.result.losses} down`}
							value={`${it.result.roundTrips}`}
							tone="muted"
						/>
						<Metric
							label="Fees paid"
							value={amount(it.result.feesLamports, 9)}
							unit="SOL"
							tone="muted"
						/>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-[1fr_310px]">
					<Panel
						title="What it did"
						note="Every run and every trade, newest first, exactly as the record holds it."
						actions={
							record.isFetching ? (
								<span className="text-[11px] text-text-faint">reading</span>
							) : null
						}
					>
						{record.isPending ? (
							<Loading rows={6} />
						) : record.error ? (
							<Failed detail={record.error.message} retry={() => record.refetch()} />
						) : record.data?.length ? (
							<ul className="max-h-[560px] overflow-y-auto">
								{record.data.map((entry) => (
									<Entry key={entry.id} entry={entry} />
								))}
							</ul>
						) : (
							<Empty
								icon={Pulse}
								title="It has not done anything yet"
								note="The record fills in as the machine runs. Nothing is written here that the machine did not actually do."
							/>
						)}
					</Panel>

					<div className="space-y-4">
						<Panel title="What it may not do" note="Enforced by the signer, not by the machine.">
							<Row label="Most per trade">
								{it.limits.maxPerTrade ? amount(it.limits.maxPerTrade) : "not set"}
							</Row>
							<Row label="Most per day">
								{it.limits.maxPerDay ? amount(it.limits.maxPerDay) : "not set"}
							</Row>
							<Row label="Approved tokens">{it.limits.approvedMints.length}</Row>
							<div className="flex flex-wrap gap-1.5 px-4 py-2.5">
								{it.limits.approvedMints.map((mint) => (
									<span
										key={mint}
										title={mint}
										className="rounded border border-line bg-inset px-1.5 py-0.5 font-mono text-[10.5px] text-text-faint"
									>
										{`${mint.slice(0, 4)}…${mint.slice(-4)}`}
									</span>
								))}
							</div>
						</Panel>

						<Panel
							title="What it does"
							note="The definition it was pinned to when it was made."
							actions={<PencilSimple size={13} className="text-text-faint" />}
						>
							<pre className="max-h-[320px] overflow-auto px-4 py-3 font-mono text-[11px] text-text-muted leading-[1.7]">
								{JSON.stringify(it.settings, null, 2)}
							</pre>
						</Panel>
					</div>
				</div>
			</div>
		</Shell>
	);
}

/** What came home, with a link to every transaction, and anything that could not. */
function Withdrawn({ result }: { result: WithdrawnEverything }) {
	if (result.status === "refused") {
		return (
			<p className="mb-5 rounded-md border border-danger/30 bg-danger-wash/40 px-3 py-2 font-mono text-[12px] text-danger-text">
				{result.reason}
			</p>
		);
	}
	const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
	const token = (mint: string) => (mint === USDC ? "USDC" : `${mint.slice(0, 4)}…`);
	return (
		<div className="mb-5 rounded-lg border border-line bg-surface px-3.5 py-3 text-[12.5px]">
			<p className="font-medium text-text">
				Sent home to {result.to.slice(0, 4)}…{result.to.slice(-4)}
			</p>
			<ul className="mt-2 space-y-1 font-mono text-[12px] text-text-muted">
				{result.tokens.map((t) => (
					<li key={`${t.from}-${t.mint}`}>
						{amount(t.amount)} {token(t.mint)} from the {t.from === "vault" ? "vault" : "machine"}
					</li>
				))}
				{result.lamports !== "0" ? <li>{amount(result.lamports, 9)} SOL</li> : null}
			</ul>
			{result.leftBehind.length > 0 ? (
				<ul className="mt-2 space-y-1 text-[12px] text-danger-text">
					{result.leftBehind.map((t) => (
						<li key={`left-${t.from}-${t.mint}`}>
							Left behind: {amount(t.amount)} {token(t.mint)}, {t.because}
						</li>
					))}
				</ul>
			) : null}
			<div className="mt-2 flex flex-wrap gap-3">
				{result.signatures.map((signature) => (
					<a
						key={signature}
						href={`https://solscan.io/tx/${signature}`}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 font-mono text-[11.5px] text-text-faint hover:text-text"
					>
						{signature.slice(0, 8)}… <ArrowSquareOut size={11} />
					</a>
				))}
			</div>
		</div>
	);
}
