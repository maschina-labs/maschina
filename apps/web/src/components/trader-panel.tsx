import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ApiError } from "../lib/machines.ts";

/**
 * The paper AI trader, beside the manager's chat: start it, watch it, stop it.
 *
 * Paper on real prices: every figure here is pretend money, filled at what real quotes said, so it is
 * labelled paper everywhere it shows. It refreshes every few seconds while a run is going.
 */

type Run = {
	id: string;
	status: "running" | "paused" | "stopped";
	pausedBecause?: string;
	startingCash: string;
	cash: string;
	worth: string;
	realized: string;
	fees: string;
	trades: number;
	holdings: { symbol: string; mint: string; cost: string; worth: string | null }[];
	thinking: { spentUsd: number; turns: number; lastAt?: string };
	log: { at: string; kind: string; text: string; costUsd?: number }[];
};

type Api = ReturnType<typeof useRouter>["options"]["context"]["api"];

async function read(response: Response): Promise<{ run: Run | null }> {
	if (response.ok) return (await response.json()) as { run: Run | null };
	const body = (await response.json().catch(() => undefined)) as
		| { error?: { message?: string } }
		| undefined;
	throw new ApiError(
		body?.error?.message ?? `The API answered ${response.status}.`,
		response.status,
	);
}

const KEY = ["trader"];

const change = (worth: string, start: string) => {
	const now = Number(worth);
	const was = Number(start);
	if (!was) return "";
	const pct = ((now - was) / was) * 100;
	return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
};

const time = (iso: string) =>
	new Date(iso).toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
	});

export function TraderPanel({ api }: { api: Api }) {
	const queryClient = useQueryClient();
	const [cash, setCash] = useState("40");
	const status = useQuery({
		queryKey: KEY,
		queryFn: async () => read(await api.v1.manager.trader.$get()),
		refetchInterval: 5_000,
	});
	const start = useMutation({
		mutationFn: async (cashUsd: number) =>
			read(await api.v1.manager.trader.$post({ json: { cashUsd } })),
		onSuccess: (data) => queryClient.setQueryData(KEY, data),
	});
	const stop = useMutation({
		mutationFn: async () => read(await api.v1.manager.trader.stop.$post()),
		onSuccess: (data) => queryClient.setQueryData(KEY, data),
	});
	const run = status.data?.run;
	const going = run && run.status !== "stopped";

	return (
		<section aria-label="Paper trader" className="flex min-h-0 flex-col gap-3 bg-white/[0.04] p-4">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-[15px] text-neutral-100">
					AI trader <span className="text-neutral-500">· paper</span>
				</h2>
				{going ? (
					<button
						type="button"
						onClick={() => stop.mutate()}
						disabled={stop.isPending}
						className="bg-white/[0.08] px-3 py-1.5 text-[13px] text-neutral-100 hover:bg-white/[0.14] disabled:opacity-40"
					>
						Stop
					</button>
				) : null}
			</div>

			{!going ? (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						start.mutate(Number(cash));
					}}
					className="flex flex-col gap-2"
				>
					<p className="text-[14px] text-neutral-400">
						It sweeps hundreds of Solana tokens, trades on its own inside its limits, and thinks on
						your key. Pretend money, real prices.
					</p>
					<div className="flex gap-1">
						<span className="grid place-items-center bg-white/[0.06] px-3 text-[14px] text-neutral-400">
							$
						</span>
						<input
							aria-label="Paper cash"
							inputMode="decimal"
							value={cash}
							onChange={(event) => setCash(event.target.value)}
							className="w-24 bg-white/[0.06] px-3 py-2 text-[15px] text-neutral-100 outline-none"
						/>
						<button
							type="submit"
							disabled={start.isPending || !(Number(cash) >= 5)}
							className="bg-white px-4 py-2 text-[14px] text-neutral-950 disabled:opacity-30"
						>
							{start.isPending ? "Starting" : "Start paper trading"}
						</button>
					</div>
					{start.error ? (
						<p role="alert" className="text-[14px] text-neutral-100">
							{start.error.message}
						</p>
					) : null}
				</form>
			) : null}

			{run ? (
				<>
					<div className="grid grid-cols-3 gap-1 text-[13px]">
						<Figure
							name="Worth"
							value={`$${run.worth}`}
							note={change(run.worth, run.startingCash)}
						/>
						<Figure name="Cash" value={`$${run.cash}`} />
						<Figure name="Trades" value={String(run.trades)} />
						<Figure name="Realized" value={`$${run.realized}`} />
						<Figure name="Fees" value={`$${run.fees}`} />
						<Figure
							name="AI cost"
							value={`$${run.thinking.spentUsd.toFixed(2)}`}
							note={`${run.thinking.turns} looks`}
						/>
					</div>
					{run.status === "paused" ? (
						<p role="status" className="text-[14px] text-neutral-100">
							Paused: {run.pausedBecause}
						</p>
					) : null}
					{run.status === "stopped" ? (
						<p className="text-[13px] text-neutral-500">Stopped. Start again for a new run.</p>
					) : null}
					{run.holdings.length ? (
						<ul aria-label="Holding" className="flex flex-col gap-1">
							{run.holdings.map((held) => (
								<li
									key={held.mint}
									className="flex justify-between bg-white/[0.06] px-3 py-2 text-[14px]"
								>
									<span className="text-neutral-100">{held.symbol}</span>
									<span className="text-neutral-400">
										${held.cost} → {held.worth === null ? "?" : `$${held.worth}`}
									</span>
								</li>
							))}
						</ul>
					) : null}
					<ol
						aria-label="What it did"
						data-own-drag
						className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto"
					>
						{run.log.map((entry, index) => (
							<li
								key={`${entry.at}-${index}`}
								className="whitespace-pre-wrap text-[13px] leading-snug text-neutral-300"
							>
								<span className="text-neutral-500">
									{time(entry.at)} · {entry.kind}
									{entry.costUsd === undefined ? "" : ` · ${(entry.costUsd * 100).toFixed(1)}¢`}
								</span>
								<br />
								{entry.text}
							</li>
						))}
						{run.log.length === 0 ? (
							<li className="text-[13px] text-neutral-500">Its first look is on the way.</li>
						) : null}
					</ol>
				</>
			) : null}
		</section>
	);
}

function Figure({ name, value, note }: { name: string; value: string; note?: string }) {
	return (
		<div className="flex flex-col bg-white/[0.06] px-3 py-2">
			<span className="text-neutral-500">{name}</span>
			<span className="text-[15px] text-neutral-100">{value}</span>
			{note ? <span className="text-neutral-500">{note}</span> : null}
		</div>
	);
}
