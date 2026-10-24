import { CaretRight } from "@phosphor-icons/react";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS } from "./links.ts";

export function HowItWorksSection() {
	const m = useMessages().home.workflow;
	return (
		<section
			aria-label={m.name}
			className="margin-dots relative bg-black px-(--gutter) py-20 sm:py-28"
		>
			<div
				aria-hidden="true"
				className="layout-rails pointer-events-none absolute inset-y-0 left-(--gutter) right-(--gutter) border-x border-[oklch(0.94_0.012_245/0.12)]"
			/>
			<div className="relative grid gap-12 px-4 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16 lg:px-12">
				<div className="lg:sticky lg:top-28">
					<h2 className="max-w-[15ch] font-display text-[clamp(2.25rem,4vw,4rem)] font-normal text-white leading-[1.08] tracking-[-0.035em]">
						{m.title}
					</h2>
					<p className="mt-6 max-w-[38ch] text-base text-neutral-400 leading-relaxed">{m.line}</p>
					<Link
						href={`${DOCS}/quickstart`}
						className="mt-8 inline-flex items-center gap-2 text-[oklch(0.94_0.012_245)] hover:text-white"
					>
						{m.docs}
						<CaretRight aria-hidden="true" className="size-4 translate-y-px" />
					</Link>
				</div>
				<ol className="space-y-5">
					{m.steps.map((step, index) => (
						<li key={step.title} className="technical-surface relative overflow-hidden p-6 sm:p-8">
							<span
								aria-hidden="true"
								className="absolute -right-2 -bottom-5 select-none font-display text-[9rem] leading-none tracking-[-0.06em] text-[oklch(0.95_0_0/0.035)]"
							>
								{String(index + 1).padStart(2, "0")}
							</span>
							<span className="relative inline-flex size-10 items-center justify-center bg-[linear-gradient(145deg,oklch(0.97_0.008_245),oklch(0.79_0.012_245))] text-sm text-[oklch(0.2_0_0)] shadow-[4px_6px_16px_oklch(0_0_0/0.25)]">
								{String(index + 1).padStart(2, "0")}
							</span>
							<h3 className="relative mt-6 font-display text-2xl text-white tracking-tight sm:text-3xl">
								{step.title}
							</h3>
							<p className="relative mt-4 max-w-[45ch] text-base text-neutral-400 leading-relaxed">
								{step.body}
							</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
