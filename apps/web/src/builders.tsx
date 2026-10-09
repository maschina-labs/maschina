import { Glint } from "./glint.tsx";
import { SOCIALS } from "./socials.ts";
import { TryButton } from "./try-button.tsx";

const GITHUB = SOCIALS.find((social) => social.label === "Maschina on GitHub")?.href ?? "";

/**
 * For anyone who builds: one headline, one gray line and two buttons, all left aligned. It says only what is true
 * today. The code is source-available (not open source: the license limits what it may be used for), so it
 * says "source-available" and never "open source". There is nothing here about an SDK, a package, an MCP
 * server or a skill file, because none of those is published; they get a place here when they are.
 */
export function Builders() {
	return (
		<section aria-label="For builders" className="relative bg-black px-(--gutter) py-32">
			<h2 className="-mb-[0.14em] max-w-[14ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-left font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
				Read every line.
			</h2>
			<p className="mt-6 max-w-[44ch] text-left text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400 leading-snug">
				Maschina is source-available. Read the code and see exactly what a machine can and cannot
				do.
			</p>
			<div className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row">
				<TryButton
					href={GITHUB}
					label="View the code"
					className="flex h-9 pr-1 pl-5 sm:inline-flex"
					labelClassName="flex-1 text-left"
					chipClassName="size-7"
					glint
				/>
				<a
					href="/docs"
					className="group relative inline-flex h-9 items-center justify-center overflow-hidden bg-white/[0.13] px-5 text-neutral-200 transition-colors hover:bg-white/[0.18]"
				>
					<Glint tone="bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.25)_50%,transparent)]" />
					Read the docs
				</a>
			</div>
		</section>
	);
}
