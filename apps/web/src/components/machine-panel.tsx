import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { describeEvent } from "../lib/describe.ts";
import {
	amount,
	type MachineAction,
	type MachineDetail,
	type RecordEntry,
	useMachine,
	useMachineAction,
	useRecord,
	useWithdrawEverything,
} from "../lib/machines.ts";
import { fetchPrice } from "../lib/price.ts";
import { statusOf } from "../lib/status.ts";

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

/** Where the price sits between the buy and sell lines, 0 at buy and 1 at sell, held to the track. */
export function placeInBand(price: number, buy: number, sell: number): number {
	if (!(sell > buy)) return 0;
	return Math.min(1, Math.max(0, (price - buy) / (sell - buy)));
}

function BandMeter({ price, buy, sell }: { price: number | undefined; buy: number; sell: number }) {
	const at = price === undefined ? undefined : placeInBand(price, buy, sell);
	return (
		<div className="flex flex-col gap-2">
			<div className="relative h-5">
				<div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
				<div className="absolute top-0 left-0 h-full w-px bg-white/50" />
				<div className="absolute top-0 right-0 h-full w-px bg-white/50" />
				{at !== undefined ? (
					<div
						role="img"
						aria-label="The price"
						className="-translate-x-1/2 absolute top-0 h-full w-0.5 bg-neutral-100"
						style={{ left: `${at * 100}%` }}
					/>
				) : null}
			</div>
			<div className="flex justify-between text-[11px] text-neutral-400 tabular-nums">
				<span>BUY {buy.toFixed(2)}</span>
				<span className="text-neutral-100">{price === undefined ? "…" : price.toFixed(2)}</span>
				<span>SELL {sell.toFixed(2)}</span>
			</div>
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

export function MachinePanelView({
	machine,
	record,
	price,
	busy,
	onAction,
	onWithdraw,
}: {
	machine: MachineDetail;
	record: RecordEntry[];
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
	const controls = machine.actions.filter((action) => action !== "fund");
	const button =
		"h-9 w-full border border-white/25 text-[11px] text-neutral-100 tracking-[0.14em] transition-colors hover:bg-white/[0.06] disabled:opacity-40";
	return (
		<article aria-label={machine.name} className="flex flex-col gap-8">
			<header className="flex flex-wrap items-baseline justify-between gap-4">
				<h1 className="text-[20px] text-neutral-100 tracking-[0.08em]">
					{machine.name.toUpperCase()}
				</h1>
				<span className={LABEL}>
					{machine.kind.toUpperCase()} · {machine.state.toUpperCase()}
				</span>
			</header>

			<div className="grid border-white/[0.07] border-r border-b sm:grid-cols-3">
				<Cell label="STATUS">
					<span className="text-[15px] text-neutral-100">{statusOf(machine)}</span>
				</Cell>
				<Cell label="BAND">
					{buy !== undefined && sell !== undefined ? (
						<BandMeter price={price} buy={buy} sell={sell} />
					) : null}
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
								onClick={() => onAction(action)}
								className={button}
							>
								{action.toUpperCase()}
							</button>
						))}
						{SETTLED.has(machine.state) ? (
							<button type="button" disabled={busy} onClick={onWithdraw} className={button}>
								WITHDRAW EVERYTHING
							</button>
						) : null}
					</div>
				</Cell>
			</div>

			<section aria-label="Record" className="flex flex-col gap-3">
				<h2 className={LABEL}>RECORD</h2>
				<ol className="flex flex-col">
					{record.map((entry) => {
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
		</article>
	);
}

export function MachinePanel({ machineId }: { machineId: string }) {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const machine = useMachine(api, machineId);
	const record = useRecord(api, machineId);
	const act = useMachineAction(api, queryClient, machineId);
	const withdraw = useWithdrawEverything(api, queryClient, machineId);
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});

	if (machine.error)
		return (
			<p role="alert" className="text-[12px] text-neutral-500">
				{machine.error.message}
			</p>
		);
	if (!machine.data) return <p className="text-[12px] text-neutral-500">…</p>;
	return (
		<>
			<MachinePanelView
				machine={machine.data}
				record={[...(record.data ?? [])].reverse()}
				price={price.data?.usd}
				busy={act.isPending || withdraw.isPending}
				onAction={(action) => act.mutate({ action })}
				onWithdraw={() => withdraw.mutate()}
			/>
			{act.error || withdraw.error ? (
				<p role="alert" className="mt-3 text-[12px] text-neutral-400">
					{(act.error ?? withdraw.error)?.message}
				</p>
			) : null}
		</>
	);
}
