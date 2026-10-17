import { useEffect, useRef, useState } from "react";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS } from "./links.ts";
import { type Kind, RUST_LINES } from "./rust-sample.ts";
import { SOCIALS } from "./socials.ts";
import { TryButton } from "./try-button.tsx";

const GITHUB = SOCIALS.find((social) => social.label === "Maschina on GitHub")?.href ?? "";

const COLORS: Record<Kind, string> = {
	comment: "text-neutral-500",
	keyword: "text-[oklch(0.82_0.08_300)]",
	type: "text-[oklch(0.84_0.05_215)]",
	string: "text-[oklch(0.82_0.06_150)]",
	macro: "text-[oklch(0.86_0.06_70)]",
	number: "text-[oklch(0.84_0.06_30)]",
	attribute: "text-neutral-500",
	plain: "text-neutral-300",
};

/** The module drawn like an editor does: a number for each line, and each piece in its own soft color. */
function Source() {
	return (
		<>
			{RUST_LINES.map((pieces, index) => (
				<div key={index} data-line>
					<span
						data-gutter
						className="inline-block w-10 pr-4 text-right text-neutral-600 select-none"
					>
						{index + 1}
					</span>
					{pieces.map((piece, at) => (
						<span key={at} data-token={piece.kind} className={COLORS[piece.kind]}>
							{piece.text}
						</span>
					))}
				</div>
			))}
		</>
	);
}

/** Whether the element is on or near the screen, so what moves can stop when nobody can see it. Always true where the browser cannot watch. */
function useLive(margin: string) {
	const box = useRef<HTMLElement>(null);
	const [live, setLive] = useState(typeof IntersectionObserver === "undefined");
	useEffect(() => {
		const node = box.current;
		if (!node || typeof IntersectionObserver === "undefined") return;
		const watcher = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) setLive(entry.isIntersecting);
			},
			{ rootMargin: margin },
		);
		watcher.observe(node);
		return () => watcher.disconnect();
	}, [margin]);
	return { box, live };
}

const STREAM =
	"animate-stream whitespace-pre font-mono text-[13px] leading-[1.7] motion-reduce:animate-none [animation-play-state:paused] group-data-[live=true]/code:[animation-play-state:running]";

/**
 * For anyone who builds, as a chapter of its own: the words sit on a pane of glass, like a screen, over Rust that streams
 * slowly down the left behind it, blurred past reading and fading out toward the right. The code is atmosphere only
 * and stops while the section is off screen. The words say only what is true today. The code is source-available (not
 * open source: the license limits what it may be used for), so it says "source-available" and never "open source". There
 * is nothing here about an SDK, a package, an MCP server or a skill file, because none of those is published.
 */
export function Builders() {
	const messages = useMessages();
	const m = messages.home.builders;
	const { box, live } = useLive("200px 0px");
	return (
		<section
			ref={box}
			aria-label={m.name}
			className="relative overflow-hidden bg-black px-(--gutter) py-20 sm:py-32"
		>
			<div data-frame className="relative w-full overflow-hidden py-10 sm:py-16">
				<div
					data-code
					data-live={live}
					aria-hidden="true"
					className="group/code pointer-events-none absolute inset-y-0 left-0 w-full overflow-hidden blur-[1px] opacity-35 lg:opacity-80 [mask-image:linear-gradient(to_right,black,black_45%,transparent_95%),linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)] [mask-composite:intersect] [-webkit-mask-composite:source-in] lg:w-[52%]"
				>
					<div data-stream className={`absolute top-0 left-0 w-full ${STREAM}`}>
						<Source />
						<Source />
					</div>
				</div>
				{/* Frosted glass over the whole section: it softens the code into fog, and fades out toward the right. */}
				<div
					data-fog
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 backdrop-blur-[2px] [mask-image:linear-gradient(to_right,black,black_55%,transparent)]"
				/>
				<div className="relative flex w-full flex-col items-start lg:ml-auto lg:w-[50%]">
					<h2 className="-mb-[0.14em] max-w-[14ch] bg-clip-text bg-[linear-gradient(105deg,oklch(0.76_0.012_260)_0%,oklch(0.92_0.008_260)_28%,oklch(1_0_0)_44%,oklch(0.86_0.01_260)_60%,oklch(0.78_0.012_260)_100%)] pb-[0.14em] text-left font-display font-normal text-[clamp(2.25rem,5vw,4.5rem)] text-transparent leading-[1.05] tracking-[-0.03em] [-webkit-text-stroke:1px_oklch(1_0_0/0.4)] [text-wrap:balance]">
						{m.title}
					</h2>
					<p className="mt-6 max-w-[44ch] text-left text-[clamp(1rem,1.3vw,1.125rem)] text-neutral-400 leading-snug">
						{m.line}
					</p>
					<div className="mt-10 flex w-full max-w-sm flex-col items-stretch gap-3 text-[15px] sm:w-auto sm:max-w-none sm:flex-row sm:justify-start">
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
				</div>
			</div>
		</section>
	);
}
