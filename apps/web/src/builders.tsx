import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS } from "./links.ts";
import { SOCIALS } from "./socials.ts";
import { TryButton } from "./try-button.tsx";

const GITHUB = SOCIALS.find((social) => social.label === "Maschina on GitHub")?.href ?? "";

/**
 * For anyone who builds: one headline, one gray line and two buttons, all centered like every other section. It says only what is true
 * today. The code is source-available (not open source: the license limits what it may be used for), so it
 * says "source-available" and never "open source". There is nothing here about an SDK, a package, an MCP
 * server or a skill file, because none of those is published; they get a place here when they are.
 */
export function Builders() {
	const m = useMessages().home.builders;
	return (
		<section
			aria-label={m.name}
			className="relative flex flex-col items-center bg-black px-(--gutter) py-20 sm:py-32"
		>
			<h2 className="-mb-[0.14em] max-w-[14ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-center font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
				{m.title}
			</h2>
			<p className="mt-6 max-w-[44ch] text-center text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400 leading-snug">
				{m.line}
			</p>
			<div className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
				<TryButton
					href={GITHUB}
					label={m.view}
					className="flex h-10 px-5 sm:inline-flex sm:pr-1 xl:h-8"
					labelClassName="flex-1 text-center sm:text-left"
					chipClassName="size-7 xl:size-6"
				/>
				<Link
					href={DOCS}
					className="inline-flex h-10 items-center justify-center bg-white/[0.13] xl:h-8 px-5 text-neutral-200 transition-colors hover:bg-white/[0.18] max-sm:font-medium max-sm:text-white"
				>
					{m.docs}
				</Link>
			</div>
		</section>
	);
}
