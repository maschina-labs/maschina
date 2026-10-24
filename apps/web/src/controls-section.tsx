import { Pause, Play } from "@phosphor-icons/react";
import { useState } from "react";
import { useMessages } from "./i18n/use-messages.ts";

export function ControlsSection() {
	const m = useMessages().home.controls;
	const [width, setWidth] = useState(2.5);
	const [amount, setAmount] = useState(25);
	const [paused, setPaused] = useState(false);
	const card = "grid w-full overflow-hidden bg-[oklch(0.17853_0.00407_285.98)] lg:grid-cols-2";
	const copy = "order-2 lg:order-1 flex flex-col justify-center p-6 sm:p-10 lg:p-12";
	const art =
		"technical-surface relative order-1 lg:order-2 flex min-h-[19rem] flex-col items-center justify-center overflow-hidden p-8 text-[oklch(0.94_0.006_245)] sm:min-h-[25rem]";
	return (
		<section
			aria-label={m.name}
			className="margin-dots relative overflow-hidden bg-black px-(--gutter) py-20 sm:py-28"
		>
			<div
				aria-hidden="true"
				className="layout-rails pointer-events-none absolute inset-y-0 left-(--gutter) right-(--gutter) border-x border-[oklch(0.94_0.012_245/0.12)]"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 left-(--gutter) right-(--gutter) opacity-60 [background-image:radial-gradient(oklch(0.7_0_0/0.14)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_80%,transparent)]"
			/>
			<div className="relative px-4 sm:px-8 lg:px-12">
				<div className="mb-10 flex items-end justify-between gap-6">
					<div>
						<h2 className="max-w-[18ch] font-display text-[clamp(2.25rem,4vw,4rem)] font-normal text-white leading-[1.08] tracking-[-0.035em]">
							{m.title}
						</h2>
						<p className="mt-5 max-w-[52ch] text-base text-neutral-400 leading-relaxed">{m.line}</p>
					</div>
				</div>
				<fieldset aria-label={m.cards} className="flex flex-col gap-6 sm:gap-8">
					<article className={card}>
						<div className={copy}>
							<h3 className="font-display text-3xl text-white tracking-tight sm:text-4xl">
								{m.rangeTitle}
							</h3>
							<p className="mt-5 max-w-[34ch] text-neutral-400 leading-relaxed">{m.rangeBody}</p>
							<label className="mt-10 block w-full text-sm text-neutral-300">
								{m.rangeLabel}
								<span className="float-right text-[oklch(0.94_0.018_245)]">
									±{width.toFixed(1)}%
								</span>
								<input
									type="range"
									min="0.5"
									max="5"
									step="0.1"
									value={width}
									onChange={(event) => setWidth(Number(event.target.value))}
									className="mt-5 block w-full cursor-ew-resize accent-[oklch(0.94_0.018_245)]"
								/>
							</label>
						</div>
						<div className={art}>
							<span className="text-sm">{m.rangeVisual}</span>
							<span className="mt-4 font-display text-[clamp(3rem,7vw,6rem)] leading-none tracking-[-0.06em]">
								±{width.toFixed(1)}%
							</span>
							<div
								aria-hidden="true"
								className="mt-10 flex h-20 w-full items-center bg-[oklch(0.7_0_0/0.08)]"
							>
								<div
									className="mx-auto h-full bg-[linear-gradient(120deg,oklch(0.99_0.008_245),oklch(0.78_0.04_245))] shadow-[0_12px_32px_oklch(0.3_0.02_250/0.15)]"
									style={{ width: `${15 + width * 15}%` }}
								/>
							</div>
						</div>
					</article>
					<article className={card}>
						<div className={copy}>
							<h3 className="font-display text-3xl text-white tracking-tight sm:text-4xl">
								{m.amountTitle}
							</h3>
							<p className="mt-5 max-w-[34ch] text-neutral-400 leading-relaxed">{m.amountBody}</p>
							<label className="mt-10 block w-full text-sm text-neutral-300">
								{m.amountLabel}
								<span className="float-right text-[oklch(0.94_0.018_245)]">{amount} USDC</span>
								<input
									type="range"
									min="5"
									max="100"
									step="5"
									value={amount}
									onChange={(event) => setAmount(Number(event.target.value))}
									className="mt-5 block w-full cursor-ew-resize accent-[oklch(0.94_0.018_245)]"
								/>
							</label>
						</div>
						<div className={art}>
							<span className="text-sm">{m.amountLabel}</span>
							<span className="mt-4 font-display text-[clamp(3rem,7vw,6rem)] leading-none tracking-[-0.06em]">
								{amount}
								<span className="ml-3 text-xl tracking-normal">USDC</span>
							</span>
							<div
								aria-hidden="true"
								className="mt-10 flex h-24 w-full items-end justify-center gap-2"
							>
								{[0, 1, 2, 3, 4].map((index) => (
									<div
										key={index}
										className="w-10 bg-[linear-gradient(180deg,oklch(0.99_0.008_245),oklch(0.73_0.025_250))] shadow-[4px_8px_12px_oklch(0.3_0.02_250/0.15)]"
										style={{ height: `${20 + amount * 0.6 + index * 4}%` }}
									/>
								))}
							</div>
						</div>
					</article>
					<article className={card}>
						<div className={copy}>
							<h3 className="font-display text-3xl text-white tracking-tight sm:text-4xl">
								{m.stopTitle}
							</h3>
							<p className="mt-5 max-w-[34ch] text-neutral-400 leading-relaxed">{m.stopBody}</p>
							<button
								type="button"
								aria-pressed={paused}
								onClick={() => setPaused((value) => !value)}
								className="mt-10 flex w-full items-center justify-center gap-3 lg:w-fit lg:justify-start bg-[oklch(0.94_0.018_245)] px-5 py-3 text-[oklch(0.18_0.008_245)] hover:bg-[oklch(0.99_0.008_245)]"
							>
								{paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
								{paused ? m.resume : m.pause}
							</button>
						</div>
						<div className={art}>
							<div
								aria-hidden="true"
								className="grid size-32 place-items-center bg-[oklch(0.96_0.01_245)] text-[oklch(0.2_0_0)] shadow-[12px_20px_40px_oklch(0.3_0.02_250/0.2)]"
							>
								{paused ? (
									<Pause className="size-16" weight="fill" />
								) : (
									<Play className="size-16" weight="fill" />
								)}
							</div>
							<span className="mt-8 font-display text-3xl">{paused ? m.paused : m.running}</span>
						</div>
					</article>
				</fieldset>
				<p className="mt-4 text-xs text-neutral-500">{m.sample}</p>
			</div>
		</section>
	);
}
