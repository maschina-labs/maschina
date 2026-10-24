import { useEffect, useRef, useState } from "react";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS } from "./links.ts";
import { SOCIALS } from "./socials.ts";
import { type Kind, SOURCE_LINES } from "./source-sample.ts";
import { TryButton } from "./try-button.tsx";

const GITHUB = SOCIALS.find((social) => social.label === "Maschina on GitHub")?.href ?? "";

const COLORS: Record<Kind, string> = {
	comment: "text-neutral-600",
	keyword: "text-[oklch(0.8_0.08_285)]",
	type: "text-[oklch(0.84_0.06_225)]",
	string: "text-[oklch(0.83_0.06_165)]",
	number: "text-[oklch(0.86_0.04_235)]",
	function: "text-neutral-100",
	plain: "text-neutral-300",
};

/** A legible source sample that moves slowly while the section is near the viewport. */
function Source() {
	return (
		<>
			{SOURCE_LINES.map((pieces, index) => (
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
	"animate-stream whitespace-pre font-mono text-[11px] leading-[1.75] sm:text-[12px] motion-reduce:animate-none [animation-play-state:paused] group-data-[live=true]/code:[animation-play-state:running]";

export function Builders() {
	const messages = useMessages();
	const m = messages.home.builders;
	const { box, live } = useLive("160px 0px");
	return (
		<section
			ref={box}
			aria-label={m.name}
			className="relative overflow-hidden bg-black px-(--gutter) py-20 sm:py-28"
		>
			<div className="mx-auto w-full max-w-[92rem]">
				<article
					data-frame
					className="grid border border-white/[0.14] bg-black lg:h-[clamp(36rem,66lvh,48rem)] lg:grid-cols-[1.2fr_0.8fr]"
				>
					<div className="flex min-h-[28rem] flex-col overflow-hidden bg-black sm:min-h-[32rem] lg:min-h-0">
						<div
							data-code
							data-live={live}
							aria-hidden="true"
							className="group/code relative min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]"
						>
							<div data-stream className={`absolute top-0 left-0 w-full ${STREAM}`}>
								<Source />
								<Source />
							</div>
						</div>
					</div>
					<div className="flex flex-col justify-between border-t border-white/[0.12] p-6 sm:border-t-0 sm:border-l sm:p-8 lg:p-10">
						<div>
							<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
								{m.name}
							</p>
							<h2 className="mt-5 max-w-[14ch] font-display font-normal text-[clamp(2rem,4.8vw,4.25rem)] text-white leading-[1.04] tracking-[-0.035em] [text-wrap:balance]">
								{m.title}
							</h2>
							<p className="mt-5 max-w-[38ch] text-[15px] text-neutral-400 leading-[1.6] sm:text-base">
								{m.line}
							</p>
						</div>
						<div className="mt-10">
							<div className="flex flex-col items-stretch gap-3 text-[15px] sm:flex-row">
								<TryButton
									href={GITHUB}
									label={m.view}
									className="flex h-10 px-5 sm:inline-flex sm:pr-1 xl:h-8"
									labelClassName="flex-1 text-center sm:text-left"
									chipClassName="size-7 xl:size-6"
								/>
								<Link
									href={DOCS}
									className="inline-flex h-10 items-center justify-center bg-white/[0.13] px-5 text-neutral-200 transition-colors hover:bg-white/[0.18] xl:h-8 max-sm:font-medium max-sm:text-white"
								>
									{m.docs}
								</Link>
							</div>
						</div>
					</div>
				</article>
			</div>
		</section>
	);
}
