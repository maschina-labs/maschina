import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "../components/shell.tsx";
import {
	amount,
	type MachineAction,
	useMachine,
	useMachineAction,
	useRecord,
} from "../lib/machines.ts";

export const Route = createFileRoute("/machines/$machineId")({
	component: Machine,
});

const LABEL: Record<MachineAction, string> = {
	fund: "Fund",
	start: "Start",
	pause: "Pause",
	resume: "Resume",
	stop: "Stop",
};

function Machine() {
	const { machineId } = Route.useParams();
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const machine = useMachine(api, machineId);
	const record = useRecord(api, machineId);
	const act = useMachineAction(api, queryClient, machineId);
	const [funding, setFunding] = useState("");

	return (
		<Shell>
			<div className="mx-auto w-full max-w-[1100px] px-8 py-8">
				{machine.isPending ? (
					<p className="text-muted-foreground text-sm">Loading.</p>
				) : machine.error ? (
					<p className="text-destructive text-sm">{machine.error.message}</p>
				) : (
					<>
						<div className="mb-6 flex items-start justify-between">
							<div>
								<h1 className="font-medium text-[20px] tracking-tight">{machine.data.name}</h1>
								<p className="mt-1 text-[13px] text-muted-foreground">
									{machine.data.kind} · {machine.data.state}
									{machine.data.stateReason ? ` · ${machine.data.stateReason}` : ""}
								</p>
								<p className="mt-2 font-mono text-[12px] text-muted-foreground/70">
									{machine.data.walletAddress}
								</p>
							</div>
							<div className="flex flex-wrap items-center justify-end gap-2">
								{machine.data.actions.map((action) =>
									action === "fund" ? null : (
										<button
											key={action}
											type="button"
											disabled={act.isPending}
											onClick={() => act.mutate({ action })}
											className={`rounded-lg border px-3 py-1.5 text-[13px] ${
												action === "stop"
													? "border-destructive/30 text-destructive hover:bg-destructive/10"
													: "border-border/60 hover:bg-muted"
											}`}
										>
											{LABEL[action]}
										</button>
									),
								)}
							</div>
						</div>

						{machine.data.actions.includes("fund") ? (
							<div className="mb-6 flex items-center gap-2 rounded-xl border border-border/60 p-3">
								<input
									value={funding}
									onChange={(event) => setFunding(event.target.value)}
									placeholder="Total budget in USDC, for example 25"
									className="min-w-0 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground/50"
								/>
								<button
									type="button"
									disabled={act.isPending || !/^\d+(\.\d{1,6})?$/.test(funding)}
									onClick={() => {
										const base = BigInt(Math.round(Number(funding) * 1_000_000));
										act.mutate(
											{ action: "fund", budgetGranted: base.toString() },
											{ onSuccess: () => setFunding("") },
										);
									}}
									className="rounded-lg bg-primary px-3 py-1.5 font-medium text-[13px] text-primary-foreground disabled:opacity-40"
								>
									Set budget
								</button>
							</div>
						) : null}

						{act.error ? (
							<p className="mb-4 text-[13px] text-destructive">{act.error.message}</p>
						) : null}

						<div className="mb-6 grid grid-cols-4 gap-3">
							{(
								[
									["Granted", machine.data.budget.granted],
									["Held", machine.data.budget.reserved],
									["Spent", machine.data.budget.settled],
									["Left", machine.data.budget.available],
								] as const
							).map(([label, value]) => (
								<div key={label} className="rounded-xl border border-border/60 p-4">
									<p className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.12em]">
										{label}
									</p>
									<p className="mt-2 font-mono text-[22px] leading-none tabular-nums">
										{amount(value)}
									</p>
								</div>
							))}
						</div>

						<div className="grid grid-cols-[1fr_300px] gap-4">
							<div className="overflow-hidden rounded-xl border border-border/60">
								<p className="border-border/60 border-b px-4 py-2.5 text-[11px] text-muted-foreground/60 uppercase tracking-[0.12em]">
									What it did
								</p>
								{record.isPending ? (
									<p className="px-4 py-3 text-[13px] text-muted-foreground">Loading.</p>
								) : record.data?.length ? (
									record.data.map((entry) => (
										<div
											key={entry.id}
											className="border-border/40 border-b px-4 py-2.5 text-[13px] last:border-0"
										>
											<div className="flex items-baseline justify-between gap-4">
												<span className="font-mono text-[12px] text-muted-foreground/70">
													{entry.type}
												</span>
												<span className="font-mono text-[11px] text-muted-foreground/50 tabular-nums">
													{new Date(entry.occurredAt).toLocaleString()}
												</span>
											</div>
											<pre className="mt-1 overflow-x-auto text-[11px] text-muted-foreground/60">
												{JSON.stringify(entry.payload)}
											</pre>
										</div>
									))
								) : (
									<p className="px-4 py-3 text-[13px] text-muted-foreground/60">Nothing yet.</p>
								)}
							</div>

							<div className="space-y-3">
								<div className="rounded-xl border border-border/60 p-4">
									<p className="mb-3 text-[11px] text-muted-foreground/60 uppercase tracking-[0.12em]">
										What it may not do
									</p>
									<Row label="Most per trade" value={machine.data.limits.maxPerTrade} />
									<Row label="Most per day" value={machine.data.limits.maxPerDay} />
									<p className="mt-3 text-[12px] text-muted-foreground/60">
										{machine.data.limits.approvedMints.length} approved tokens
									</p>
								</div>

								<div className="rounded-xl border border-border/60 p-4">
									<p className="mb-3 text-[11px] text-muted-foreground/60 uppercase tracking-[0.12em]">
										What it does
									</p>
									<pre className="overflow-x-auto text-[11px] text-muted-foreground/70">
										{JSON.stringify(machine.data.settings, null, 2)}
									</pre>
								</div>
							</div>
						</div>
					</>
				)}
			</div>
		</Shell>
	);
}

function Row({ label, value }: { label: string; value?: string | undefined }) {
	return (
		<div className="flex items-baseline justify-between py-0.5 text-[13px]">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-mono tabular-nums">{value ? amount(value) : "not set"}</span>
		</div>
	);
}
