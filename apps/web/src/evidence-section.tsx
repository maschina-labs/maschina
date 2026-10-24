import { PublicRecord } from "@maschina/contracts";
import { CaretRight } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link } from "./i18n/link.tsx";
import { useLocale } from "./i18n/locale-context.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { LIVE } from "./links.ts";

export function EvidenceSection() {
	const m = useMessages().home.evidence;
	const locale = useLocale();
	const [record, setRecord] = useState<PublicRecord>();
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		const controller = new AbortController();
		setFailed(false);
		fetch(import.meta.env.DEV ? "/__public-record" : "https://api.maschina.dev/v1/public/record", {
			signal: controller.signal,
			headers: { accept: "application/json" },
		})
			.then(async (response) => {
				if (!response.ok) throw new Error("Record unavailable");
				const data = PublicRecord.parse(await response.json());
				if (!controller.signal.aborted) setRecord(data);
			})
			.catch(() => {
				if (!controller.signal.aborted) setFailed(true);
			});
		return () => controller.abort();
	}, [attempt]);
	const trades = record?.live.toSorted((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 3);
	const amount = (raw: string, decimals: number) => {
		const value = BigInt(raw);
		const unit = 10n ** BigInt(decimals);
		const fraction = (value % unit).toString().padStart(decimals, "0").replace(/0+$/, "");
		return fraction ? `${value / unit}.${fraction}` : String(value / unit);
	};
	return (
		<section
			aria-label={m.name}
			className="margin-dots relative bg-black px-(--gutter) py-20 sm:py-28"
		>
			<div
				aria-hidden="true"
				className="layout-rails pointer-events-none absolute inset-y-0 left-(--gutter) right-(--gutter) border-x border-[oklch(0.94_0.012_245/0.12)]"
			/>
			<div className="relative grid gap-12 px-4 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16 lg:px-12">
				<div>
					<h2 className="max-w-[15ch] font-display text-[clamp(2.25rem,4vw,4rem)] font-normal text-white leading-[1.08] tracking-[-0.035em]">
						{m.title}
					</h2>
					<p className="mt-6 max-w-[40ch] text-base text-neutral-400 leading-relaxed">{m.line}</p>
					<p className="mt-8 max-w-[44ch] text-sm text-neutral-500 leading-relaxed">{m.context}</p>
				</div>
				<div className="bg-[oklch(0.17853_0.00407_285.98)] p-5 sm:p-8">
					<h3 className="text-lg text-[oklch(0.94_0.018_245)]">{m.latest}</h3>
					{!record ? (
						<div role="status" className="py-14 text-sm text-neutral-400">
							{failed ? m.unavailable : m.loading}
							{failed ? (
								<button
									type="button"
									onClick={() => setAttempt((value) => value + 1)}
									className="mt-5 block bg-white/10 px-4 py-2 text-white hover:bg-white/15"
								>
									{m.retry}
								</button>
							) : null}
						</div>
					) : null}
					{trades?.length === 0 ? (
						<p className="py-12 text-sm text-neutral-400">{m.empty}</p>
					) : null}
					<ul className="mt-5 space-y-3">
						{trades?.map((trade) => (
							<li key={trade.signature}>
								<Link
									href={`https://solscan.io/tx/${encodeURIComponent(trade.signature)}`}
									target="_blank"
									rel="noreferrer"
									className="group block bg-[oklch(0.21_0.002_286)] p-5 transition-colors hover:bg-[oklch(0.25_0.002_286)] focus-visible:outline focus-visible:outline-[oklch(0.94_0.018_245)]"
								>
									<div className="flex items-center justify-between gap-4">
										<span className="text-sm text-[oklch(0.86_0.02_245)]">
											{trade.side === "buy" ? m.buy : m.sell}
										</span>
										<time dateTime={trade.at} className="text-xs text-neutral-400">
											{new Date(trade.at).toLocaleString(locale, {
												month: "short",
												day: "numeric",
												year: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</time>
									</div>
									<p className="mt-3 break-words font-display text-xl text-white sm:text-2xl">
										{amount(trade.sol, 9)} SOL
									</p>
									<div className="mt-2 flex items-center justify-between gap-4">
										<span className="text-sm text-neutral-400">{amount(trade.usdc, 6)} USDC</span>
										<span className="inline-flex items-center gap-2 text-xs text-neutral-300">
											{m.transaction}
											<CaretRight aria-hidden="true" className="size-4" />
										</span>
									</div>
								</Link>
							</li>
						))}
					</ul>
					<p className="mt-5 text-xs text-neutral-500 leading-relaxed">{m.note}</p>
				</div>
				<Link
					href={LIVE}
					className="silver-button mx-auto flex min-h-12 w-full items-center justify-center px-6 py-3 text-sm text-black sm:w-fit lg:col-span-2"
				>
					{m.open}
				</Link>
			</div>
		</section>
	);
}
