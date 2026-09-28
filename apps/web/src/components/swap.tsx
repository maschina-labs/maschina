import { ArrowsDownUp } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCreateMachine } from "../lib/machines.ts";
import { fetchPrice } from "../lib/price.ts";
import { fetchQuote, type Quote, type Token } from "../lib/quote.ts";
import { numberFrom } from "../lib/range-form.ts";
import { toast } from "../lib/toasts.ts";
import { type LimitForm, limitReady, limitRequest } from "../lib/trigger-form.ts";
import { GLASS } from "./glass.ts";
import { PaperOrLive } from "./kind-picker.tsx";
import { TypeRow } from "./slider-row.tsx";

const LABEL = "text-[10.5px] text-neutral-500 tracking-[0.14em]";

export function QuoteView({
	from,
	to,
	amount,
	quote,
	failed,
}: {
	from: Token;
	to: Token;
	amount: number;
	quote: Quote | undefined;
	failed: string | undefined;
}) {
	if (failed) return <p className="text-[11px] text-neutral-400">{failed.toUpperCase()}</p>;
	if (!quote) return <p className={LABEL}>{amount > 0 ? "QUOTING…" : "TYPE AN AMOUNT"}</p>;
	const rate = from === "USDC" ? amount / quote.out : quote.out / amount;
	const rows: [string, string][] = [
		["YOU GET", `${quote.out.toFixed(to === "SOL" ? 5 : 2)} ${to}`],
		["AT LEAST", `${quote.atLeast.toFixed(to === "SOL" ? 5 : 2)} ${to}`],
		["RATE", `1 SOL = ${rate.toFixed(2)} USDC`],
		["PRICE IMPACT", `${quote.impactPct.toFixed(2)}%`],
		["ROUTE", quote.route.join(" → ").toUpperCase()],
	];
	return (
		<dl className="flex flex-col">
			{rows.map(([label, value]) => (
				<div
					key={label}
					className="flex items-baseline justify-between gap-6 border-white/[0.06] border-b py-2.5 text-[11.5px] tracking-[0.1em]"
				>
					<dt className="text-neutral-500">{label}</dt>
					<dd className="truncate text-right text-neutral-100 tabular-nums">{value}</dd>
				</div>
			))}
		</dl>
	);
}

/** Swap SOL and USDC with a live Jupiter quote. Signing from your wallet, with the fee, comes later. */
function Market() {
	const [from, setFrom] = useState<Token>("USDC");
	const [typed, setTyped] = useState("");
	const [amount, setAmount] = useState(0);
	const to: Token = from === "USDC" ? "SOL" : "USDC";

	// Asked once typing pauses, not on every key.
	useEffect(() => {
		const timer = setTimeout(() => {
			const read = numberFrom(typed);
			setAmount(Number.isFinite(read) && read > 0 ? read : 0);
		}, 400);
		return () => clearTimeout(timer);
	}, [typed]);

	const quote = useQuery({
		queryKey: ["quote", from, to, amount],
		queryFn: () => fetchQuote(from, to, amount),
		enabled: amount > 0,
		refetchInterval: 10_000,
		retry: false,
	});

	return (
		<div className="flex max-w-[480px] flex-col gap-1.5">
			<TypeRow label={`YOU PAY`} value={typed} onChange={setTyped} suffix={from} />
			<button
				type="button"
				aria-label="Swap direction"
				onClick={() => setFrom(to)}
				className={`flex h-9 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-100 ${GLASS}`}
			>
				<ArrowsDownUp size={14} weight="light" />
			</button>
			<div
				className={`flex h-12 items-center justify-between px-4 text-[12px] tracking-[0.12em] ${GLASS}`}
			>
				<span className="text-neutral-400">YOU GET</span>
				<span className="text-neutral-100 tabular-nums">
					{quote.data ? quote.data.out.toFixed(to === "SOL" ? 5 : 2) : "-"}{" "}
					<span className="text-neutral-500">{to}</span>
				</span>
			</div>
			<div className="pt-4">
				<QuoteView
					from={from}
					to={to}
					amount={amount}
					quote={amount > 0 ? quote.data : undefined}
					failed={quote.error?.message}
				/>
			</div>
			<button
				type="button"
				disabled
				className="mt-4 h-10 border border-white/25 text-[11px] text-neutral-100 tracking-[0.14em] disabled:opacity-40"
			>
				SWAP
			</button>
			<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
				SIGNING FROM YOUR WALLET ARRIVES WITH THE BACKEND PASS
			</p>
		</div>
	);
}

/** A limit order is a machine: buy once the price falls to a level. Made for real, on paper or live. */
function Limit() {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const create = useCreateMachine(api, queryClient);
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});
	const [form, setForm] = useState<LimitForm>({ level: "", spend: "", paper: true });
	// The level starts two percent under the price the first time one is known.
	const usd = price.data?.usd;
	useEffect(() => {
		if (usd !== undefined)
			setForm((was) => (was.level ? was : { ...was, level: (usd * 0.98).toFixed(2) }));
	}, [usd]);
	return (
		<div className="flex max-w-[480px] flex-col gap-1.5">
			<TypeRow
				label="BUY SOL WHEN IT FALLS TO"
				value={form.level}
				onChange={(level) => setForm({ ...form, level })}
				suffix="USD"
			/>
			<TypeRow
				label="SPEND"
				value={form.spend}
				onChange={(spend) => setForm({ ...form, spend })}
				suffix="USDC"
			/>
			<div className="pt-2">
				<PaperOrLive paper={form.paper} onChange={(paper) => setForm({ ...form, paper })} />
			</div>
			<button
				type="button"
				disabled={!limitReady(form) || create.isPending}
				onClick={() =>
					create.mutate(limitRequest(form), {
						onSuccess: (made) => {
							toast("price trigger made");
							void navigate({ to: "/machines/$machineId", params: { machineId: made.machineId } });
						},
						onError: (error) => toast(error.message, "problem"),
					})
				}
				className="mt-4 h-10 border border-white/25 text-[11px] text-neutral-100 tracking-[0.14em] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
			>
				{create.isPending ? "MAKING ITS WALLET" : "MAKE THIS A MACHINE"}
			</button>
			<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
				A PRICE TRIGGER: IT WATCHES FOR YOU AND BUYS ONCE, AT YOUR LEVEL, UNDER ITS OWN LIMITS
			</p>
		</div>
	);
}

/** Buying on a schedule is a machine too. Its schedule is not in the create request yet. */
function Recurring() {
	const [spend, setSpend] = useState("");
	const [every, setEvery] = useState<"DAY" | "WEEK">("DAY");
	return (
		<div className="flex max-w-[480px] flex-col gap-1.5">
			<TypeRow label="SPEND EACH TIME" value={spend} onChange={setSpend} suffix="USDC" />
			<fieldset className="flex gap-1.5">
				<legend className="sr-only">How often</legend>
				{(["DAY", "WEEK"] as const).map((each) => (
					<button
						key={each}
						type="button"
						aria-pressed={every === each}
						onClick={() => setEvery(each)}
						className={`h-9 flex-1 text-[11px] tracking-[0.12em] ${every === each ? "bg-[oklch(1_0_0/0.09)] text-neutral-100" : `${GLASS} text-neutral-500`}`}
					>
						EVERY {each}
					</button>
				))}
			</fieldset>
			<button
				type="button"
				disabled
				className="mt-4 h-10 border border-white/25 text-[11px] text-neutral-100 tracking-[0.14em] disabled:opacity-40"
			>
				MAKE THIS A MACHINE
			</button>
			<p className="text-[10px] text-neutral-600 tracking-[0.1em]">
				RECURRING BUYS ARRIVE WITH THE BACKEND PASS
			</p>
		</div>
	);
}

const TABS = ["MARKET", "LIMIT", "RECURRING"] as const;

/** Swap now, or make it a machine: a limit order is a price trigger, and a schedule is a recurring buy. */
export function Swap() {
	const [tab, setTab] = useState<(typeof TABS)[number]>("MARKET");
	return (
		<div className="flex flex-col gap-6">
			<fieldset className="flex gap-6 text-[11px] tracking-[0.14em]">
				<legend className="sr-only">Kind of swap</legend>
				{TABS.map((each) => (
					<button
						key={each}
						type="button"
						aria-pressed={tab === each}
						onClick={() => setTab(each)}
						className={
							tab === each ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
						}
					>
						{each}
					</button>
				))}
			</fieldset>
			{tab === "MARKET" ? <Market /> : tab === "LIMIT" ? <Limit /> : <Recurring />}
		</div>
	);
}
