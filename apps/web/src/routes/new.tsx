import { priceTrigger, range } from "@maschina/runtime";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "../components/shell.tsx";
import { useCreateMachine } from "../lib/machines.ts";
import {
	bandOf,
	mostPerBuy,
	numberFrom,
	rangeReady,
	rangeRequest,
	sixDecimals,
} from "../lib/range-form.ts";

export const Route = createFileRoute("/new")({
	component: NewMachine,
});

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

/** USDC has six decimals, and every amount crosses the wire as digits in base units. */
const usdc = sixDecimals;
/** A price level is micro dollars, so the same six. */
const dollars = sixDecimals;

type Kind = "range" | "trigger";

function NewMachine() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const create = useCreateMachine(api, queryClient);

	const [kind, setKind] = useState<Kind>("range");

	const [name, setName] = useState("SOL range");
	const [level, setLevel] = useState("108");
	const [perTrade, setPerTrade] = useState("5");
	const [budget, setBudget] = useState("25");
	const [perDay, setPerDay] = useState("15");

	const [buyAt, setBuyAt] = useState("");
	const [sellAt, setSellAt] = useState("");
	const [perBuy, setPerBuy] = useState("9.75");
	const [float, setFloat] = useState("10");

	const { width: band, covers: bandCovers, keeps } = bandOf(buyAt, sellAt);

	const ready =
		kind === "range"
			? rangeReady({ name, buyAt, sellAt, perBuy, float })
			: [name, level, perTrade, budget, perDay].every(Boolean) &&
				[level, perTrade, budget, perDay].every((value) => numberFrom(value) > 0);

	// Built only when Create is pressed, never while typing: a half typed price is not a request.
	const buildRequest = () =>
		kind === "range"
			? rangeRequest({ name, kind: range.kind, buyAt, sellAt, perBuy, float })
			: {
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
				};

	return (
		<Shell>
			<div className="mx-auto w-full max-w-[560px] px-8 py-8">
				<h1 className="font-medium text-[20px] tracking-tight">New machine</h1>
				<div className="mt-4 inline-flex rounded-lg border border-border/60 p-0.5 text-[12px]">
					{(
						[
							["range", "Range"],
							["trigger", "Price trigger"],
						] as const
					).map(([value, label]) => (
						<button
							key={value}
							type="button"
							onClick={() => setKind(value)}
							className={`rounded-md px-3 py-1 ${kind === value ? "bg-muted text-foreground" : "text-muted-foreground"}`}
						>
							{label}
						</button>
					))}
				</div>

				<p className="mt-3 text-[13px] text-muted-foreground">
					{kind === "range"
						? "It buys SOL with USDC at the bottom of your band and sells it at the top, one position at a time. Profit above its float is banked in a vault it cannot trade from."
						: "It buys SOL with USDC when the price falls to your level."}{" "}
					It gets its own wallet, and its funds can only ever return to you.
				</p>

				{kind === "range" ? (
					<div className="mt-6 space-y-4">
						<Field label="Name" value={name} onChange={setName} />
						<div className="grid grid-cols-2 gap-3">
							<Field label="Buy SOL at (USD)" value={buyAt} onChange={setBuyAt} />
							<Field label="Sell SOL at (USD)" value={sellAt} onChange={setSellAt} />
						</div>
						{band > 0 ? (
							<p
								className={`text-[12px] ${bandCovers ? "text-muted-foreground" : "text-destructive"}`}
							>
								A {(band * 100).toFixed(2)}% band.{" "}
								{bandCovers
									? "Each round trip keeps about " + (keeps * 100).toFixed(2) + "% after costs."
									: "A round trip costs about 0.6%, so this band would lose money every time it works."}
							</p>
						) : null}
						<Field label="Spend each buy (USDC)" value={perBuy} onChange={setPerBuy} />
						{numberFrom(float) > 0 && numberFrom(perBuy) > Number(mostPerBuy(float)) ? (
							<p className="text-[12px] text-destructive">
								At most {mostPerBuy(float)} of a {float} float: each buy keeps a little back for the
								fee to send it.
							</p>
						) : null}
						<Field label="Float (USDC)" value={float} onChange={setFloat} />
						<p className="text-[12px] text-muted-foreground/60 leading-relaxed">
							The float is what it trades with. Anything it makes above that is swept into the
							vault, and never traded again.
						</p>
					</div>
				) : (
					<div className="mt-6 space-y-4">
						<Field label="Name" value={name} onChange={setName} />
						<Field label="Buy when SOL falls to (USD)" value={level} onChange={setLevel} />
						<Field label="Spend each time (USDC)" value={perTrade} onChange={setPerTrade} />
						<Field label="Most it may spend in a day (USDC)" value={perDay} onChange={setPerDay} />
						<Field label="Total budget (USDC)" value={budget} onChange={setBudget} />
					</div>
				)}

				{create.error ? (
					<p className="mt-4 text-[13px] text-destructive">{create.error.message}</p>
				) : null}

				<button
					type="button"
					disabled={!ready || create.isPending}
					onClick={() =>
						create.mutate(buildRequest(), {
							onSuccess: (made) =>
								navigate({ to: "/machines/$machineId", params: { machineId: made.machineId } }),
						})
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
