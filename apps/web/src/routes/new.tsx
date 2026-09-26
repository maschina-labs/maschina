import { priceTrigger } from "@maschina/runtime";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "../components/shell.tsx";
import { useCreateMachine } from "../lib/machines.ts";

export const Route = createFileRoute("/new")({
	component: NewMachine,
});

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

/** USDC has six decimals, and every amount crosses the wire as digits in base units. */
const usdc = (value: string) => BigInt(Math.round(Number(value) * 1_000_000)).toString();
/** A price level is micro dollars, so the same six. */
const dollars = (value: string) => BigInt(Math.round(Number(value) * 1_000_000)).toString();

function NewMachine() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const create = useCreateMachine(api, queryClient);

	const [name, setName] = useState("SOL dip buyer");
	const [level, setLevel] = useState("108");
	const [perTrade, setPerTrade] = useState("5");
	const [budget, setBudget] = useState("25");
	const [perDay, setPerDay] = useState("15");

	const ready = [name, level, perTrade, budget, perDay].every(Boolean);

	return (
		<Shell>
			<div className="mx-auto w-full max-w-[560px] px-8 py-8">
				<h1 className="font-medium text-[20px] tracking-tight">New machine</h1>
				<p className="mt-1.5 text-[13px] text-muted-foreground">
					It buys SOL with USDC when the price falls to your level. It gets its own wallet, and its
					funds can only ever return to you.
				</p>

				<div className="mt-6 space-y-4">
					<Field label="Name" value={name} onChange={setName} />
					<Field label="Buy when SOL falls to (USD)" value={level} onChange={setLevel} />
					<Field label="Spend each time (USDC)" value={perTrade} onChange={setPerTrade} />
					<Field label="Most it may spend in a day (USDC)" value={perDay} onChange={setPerDay} />
					<Field label="Total budget (USDC)" value={budget} onChange={setBudget} />
				</div>

				{create.error ? (
					<p className="mt-4 text-[13px] text-destructive">{create.error.message}</p>
				) : null}

				<button
					type="button"
					disabled={!ready || create.isPending}
					onClick={() =>
						create.mutate(
							{
								name,
								kind: priceTrigger.kind,
								settings: {
									spendMint: USDC,
									buyMint: SOL,
									level: dollars(level),
									direction: "falls_to",
									amountPerTrade: usdc(perTrade),
									slippageBps: 50,
									hysteresisBps: 50,
									minGapMs: 3_600_000,
								},
								limits: {
									budgetGranted: usdc(budget),
									maxPerTrade: usdc(perTrade),
									maxPerDay: usdc(perDay),
									approvedMints: [USDC, SOL],
								},
							},
							{
								onSuccess: (made) =>
									navigate({ to: "/machines/$machineId", params: { machineId: made.machineId } }),
							},
						)
					}
					className="mt-6 w-full rounded-lg bg-primary py-2 font-medium text-[13px] text-primary-foreground disabled:opacity-40"
				>
					{create.isPending ? "Making its wallet" : "Create machine"}
				</button>

				<p className="mt-3 text-[12px] text-muted-foreground/60 leading-relaxed">
					Creating it makes a wallet, writes a policy onto it, and reads that policy back. If
					anything does not match, no machine is made.
				</p>
			</div>
		</Shell>
	);
}

function Field({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-[12px] text-muted-foreground">{label}</span>
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="h-9 w-full rounded-lg border border-border/60 bg-transparent px-2.5 text-[13px] outline-none focus:border-border"
			/>
		</label>
	);
}
