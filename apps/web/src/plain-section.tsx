import { Glint } from "./glint.tsx";
import { TryButton } from "./try-button.tsx";

/**
 * A centered section made of the same few parts as the rest of the page: the pearl headline with the thin
 * outline, one gray line, and one or two buttons in the hero's two kinds (the pearl one, then the gray one). It
 * is the plain frame the sections are laid out in until each is designed on its own; the words are the part that
 * matters now, and every one has to be true.
 */
export function PlainSection({
	name,
	title,
	line,
	primary,
	secondary,
}: {
	name: string;
	title: string;
	line: string;
	primary: { label: string; href: string };
	secondary?: { label: string; href: string };
}) {
	return (
		<section
			aria-label={name}
			className="relative flex flex-col items-center bg-black px-(--gutter) py-20 sm:py-32"
		>
			<h2 className="-mb-[0.14em] max-w-[16ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-center font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
				{title}
			</h2>
			<p className="mt-6 max-w-[48ch] text-center text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400 leading-snug">
				{line}
			</p>
			<div className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-center">
				<TryButton
					href={primary.href}
					label={primary.label}
					className="flex h-9 px-5 sm:inline-flex sm:pr-1"
					labelClassName="flex-1 text-center sm:text-left"
					chipClassName="size-7"
					glint
				/>
				{secondary ? (
					<a
						href={secondary.href}
						className="group relative inline-flex h-9 items-center justify-center overflow-hidden bg-white/[0.13] px-5 text-neutral-200 transition-colors hover:bg-white/[0.18]"
					>
						<Glint tone="bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.25)_50%,transparent)]" />
						{secondary.label}
					</a>
				) : null}
			</div>
		</section>
	);
}
