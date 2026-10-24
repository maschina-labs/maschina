import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useMessages } from "./i18n/use-messages.ts";
import { TryButton } from "./try-button.tsx";

const MarketChart = lazy(() => import("./market-chart.tsx"));

export function PaperMode({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.paper;
	const holder = useRef<HTMLElement>(null);
	const [near, setNear] = useState(false);
	const [bandWidth, setBandWidth] = useState(2.5);
	useEffect(() => {
		if (!holder.current) return;
		if (typeof IntersectionObserver === "undefined") {
			setNear(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setNear(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "300px" },
		);
		observer.observe(holder.current);
		return () => observer.disconnect();
	}, []);
	return (
		<section
			ref={holder}
			aria-label={m.name}
			className="margin-dots relative bg-black px-(--gutter) py-20 sm:py-28"
		>
			<div
				aria-hidden="true"
				className="layout-rails pointer-events-none absolute inset-y-0 left-(--gutter) right-(--gutter) border-x border-[oklch(0.94_0.012_245/0.12)]"
			/>
			<div className="relative px-4 sm:px-8 lg:px-12">
				<div className="max-w-[60rem]">
					<div>
						<h2 className="max-w-[22ch] font-display text-[clamp(2.5rem,4.8vw,5rem)] text-[oklch(0.97_0.006_245)] leading-[1.08] tracking-[-0.035em]">
							{m.title}
						</h2>
						<p className="mt-8 max-w-[50ch] text-[clamp(1rem,1.45vw,1.25rem)] text-neutral-400 leading-relaxed">
							{m.line}
						</p>
					</div>
				</div>
				<div className="mt-12 bg-[oklch(0.17853_0.00407_285.98)] p-4 sm:p-8">
					<p className="mb-6 text-xs text-[oklch(0.8_0.018_245)]">{m.caption}</p>
					{near ? (
						<Suspense
							fallback={
								<p className="grid h-[20rem] place-items-center text-sm text-neutral-400 sm:h-[28rem]">
									{m.loading}
								</p>
							}
						>
							<MarketChart
								loading={m.loading}
								unavailable={m.unavailable}
								connected={m.connected}
								disconnected={m.disconnected}
								bandWidth={bandWidth}
								labels={m.band}
								widthControl={
									<label className="block w-full text-sm text-neutral-300">
										{m.bandLabel}
										<span className="float-right">±{bandWidth.toFixed(1)}%</span>
										<input
											aria-label={m.band.width}
											type="range"
											min="0.5"
											max="5"
											step="0.1"
											value={bandWidth}
											onChange={(event) => setBandWidth(Number(event.target.value))}
											className="mt-4 block w-full"
										/>
									</label>
								}
							/>
						</Suspense>
					) : (
						<div className="h-[20rem] sm:h-[28rem]" />
					)}
				</div>
				<TryButton
					href={`${authUrl}/sign-up`}
					label={m.start}
					className="mt-6 flex min-h-12 w-full justify-center px-5 py-3"
					labelClassName=""
					chipClassName="size-7"
				/>
			</div>
		</section>
	);
}
