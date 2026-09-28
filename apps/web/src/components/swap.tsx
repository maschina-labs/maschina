import { ArrowsDownUp } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchQuote, type Quote, type Token } from "../lib/quote.ts";
import { numberFrom } from "../lib/range-form.ts";
import { GLASS } from "./glass.ts";
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
export function Swap() {
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
