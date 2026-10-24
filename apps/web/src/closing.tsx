import { CaretRight } from "@phosphor-icons/react";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS } from "./links.ts";
import { TryButton } from "./try-button.tsx";

/**
 * The last thing before the footer: a headline, one short line under it, and the way in, in the hero's headline
 * style and with the hero's two buttons. It is
 * a calm screen on purpose: no particles, no canvas, no motion, so there is nothing between the reader and the
 * button. The line under it is true today: a machine can be made on paper, with no money at risk.
 */
export function Closing({ authUrl }: { authUrl: string }) {
	const m = useMessages().home.closing;
	return (
		<section
			aria-label={m.name}
			className="margin-dots relative flex min-h-[70lvh] flex-col items-center justify-center overflow-hidden bg-black px-(--gutter) py-24 text-center"
		>
			<div
				aria-hidden="true"
				className="layout-rails pointer-events-none absolute inset-y-0 left-(--gutter) right-(--gutter) z-10 border-x border-b border-[oklch(0.94_0.012_245/0.12)]"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-[radial-gradient(60%_90%_at_50%_100%,oklch(0.9_0.02_300/0.16),transparent_70%)] max-sm:h-[85%] max-sm:bg-[radial-gradient(90%_100%_at_50%_100%,oklch(0.92_0.03_300/0.42),transparent_72%)] [mask-image:linear-gradient(to_top,black,transparent)] [-webkit-mask-image:linear-gradient(to_top,black,transparent)]"
			/>
			<h2 className="relative -mb-[0.14em] max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] font-display font-normal text-[clamp(2.25rem,5vw,5rem)] pb-[0.14em] text-transparent leading-[1] tracking-[-0.035em] [text-wrap:balance]">
				{m.title}
			</h2>
			<p className="relative mt-5 text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400 leading-snug">
				{m.line}
			</p>
			<div className="relative mt-10 flex w-[calc(100%-3rem)] max-w-sm flex-col items-stretch justify-center sm:flex-row gap-3 text-[15px] sm:w-auto sm:max-w-none sm:justify-center">
				<TryButton
					href={`${authUrl}/sign-up`}
					label={m.start}
					className="flex h-10 px-5 sm:inline-flex sm:pr-1 xl:h-8 [--silver-fill:linear-gradient(110deg,oklch(0.8_0.025_250),oklch(0.94_0.018_250)_30%,oklch(0.99_0.006_250)_48%,oklch(0.88_0.03_250)_70%,oklch(0.79_0.035_250))]"
					labelClassName="flex-1 text-center sm:text-left"
					chipClassName="size-7 xl:size-6"
				/>
				<Link
					href={DOCS}
					className="inline-flex h-10 items-center justify-center gap-2 px-3 text-neutral-200 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white xl:h-8 max-sm:font-medium max-sm:text-white"
				>
					<span>{m.docs}</span>
					<CaretRight aria-hidden="true" className="size-4 shrink-0 translate-y-px" weight="bold" />
				</Link>
			</div>
		</section>
	);
}
