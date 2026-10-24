import { CaretRight, Pause, Play } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import limitsSource from "../../../packages/runtime/src/machine-limits.ts?raw";
import sdkSource from "../../../packages/sdk/src/machine.ts?raw";
import { Link } from "./i18n/link.tsx";
import { useMessages } from "./i18n/use-messages.ts";
import { DOCS } from "./links.ts";

function excerpt(source: string, start: string, end: string) {
	const from = source.indexOf(start);
	const to = source.indexOf(end, from);
	if (from < 0 || to < 0) throw new Error("Source excerpt is missing");
	return source.slice(from, to).trim();
}
const SAMPLES = [
	{
		code: excerpt(sdkSource, "export type Proposal", "export type DecideInput"),
		path: "packages/sdk/src/machine.ts",
	},
	{
		code: excerpt(sdkSource, "export type MachineKind", "const KIND_ID"),
		path: "packages/sdk/src/machine.ts",
	},
	{
		code: excerpt(limitsSource, "export type MachineLimits", "/** A list of addresses"),
		path: "packages/runtime/src/machine-limits.ts",
	},
];

function Source({ code }: { code: string }) {
	return (
		<pre className="relative m-0 whitespace-pre-wrap break-words font-sans [overflow-wrap:anywhere] text-[13px] text-[oklch(0.85_0.006_245)] leading-[1.9] [tab-size:2] sm:text-[15px]">
			<code className="font-sans">
				{code
					.split(/(\b(?:export|type|readonly|string|number|return|Promise|Readonly)\b|"[^"\n]*")/g)
					.map((token, index) => (
						<span
							key={index}
							className={
								/^(export|type|readonly|return)$/.test(token)
									? "text-[oklch(0.98_0.012_245)]"
									: token.startsWith('"')
										? "text-[oklch(0.78_0.025_245)]"
										: undefined
							}
						>
							{token}
						</span>
					))}
			</code>
		</pre>
	);
}

export function BuilderWorkbench() {
	const m = useMessages().home.workbench;
	const [selected, setSelected] = useState(0);
	const id = useId();
	const pane = useRef<HTMLElement>(null);
	const [visible, setVisible] = useState(typeof IntersectionObserver === "undefined");
	const [paused, setPaused] = useState(false);
	useEffect(() => {
		if (!pane.current || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver((entries) =>
			setVisible(entries.some((entry) => entry.isIntersecting)),
		);
		observer.observe(pane.current);
		return () => observer.disconnect();
	}, []);
	const streamingSource = selected === 2 ? limitsSource : sdkSource;
	const sample = SAMPLES[selected];
	const details = m.samples[selected];
	if (!sample || !details) throw new Error("Source sample is missing");
	return (
		<section
			aria-label={m.name}
			className="margin-dots relative bg-black px-(--gutter) py-20 sm:py-28"
		>
			<div
				aria-hidden="true"
				className="layout-rails pointer-events-none absolute inset-y-0 left-(--gutter) right-(--gutter) border-x border-[oklch(0.94_0.012_245/0.12)]"
			/>
			<div className="relative px-4 sm:px-8 lg:px-12">
				<div className="mb-10 grid gap-6 lg:grid-cols-2 lg:gap-16">
					<h2 className="max-w-[16ch] font-display text-[clamp(2.25rem,4vw,4rem)] font-normal text-white leading-[1.08] tracking-[-0.035em]">
						{m.title}
					</h2>
					<p className="max-w-[48ch] self-end text-base text-neutral-400 leading-relaxed">
						{m.line}
					</p>
				</div>
				<div className="technical-surface grid overflow-hidden lg:grid-cols-[0.7fr_1.3fr]">
					<div className="order-2 flex flex-col p-6 sm:p-9 lg:order-1">
						<fieldset aria-label={m.choose} className="flex flex-col gap-2">
							{m.samples.map((entry, index) => (
								<button
									key={entry.title}
									type="button"
									aria-pressed={selected === index}
									aria-controls={id}
									onClick={() => setSelected(index)}
									className={`flex items-center justify-between gap-4 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-[oklch(0.94_0.018_245)] ${selected === index ? "bg-[oklch(0.94_0.012_245)] text-[oklch(0.18_0_0)]" : "bg-[oklch(0.22_0.002_286/0.8)] text-neutral-400 hover:bg-[oklch(0.28_0.002_286)] hover:text-white"}`}
								>
									<span className="font-display text-lg">{entry.title}</span>
									<span aria-hidden="true" className="text-xs">
										{String(index + 1).padStart(2, "0")}
									</span>
								</button>
							))}
						</fieldset>
						<p className="mt-8 max-w-[34ch] text-sm text-neutral-400 leading-relaxed">
							{details.body}
						</p>
						<Link
							href={`${DOCS}/sdk`}
							className="mt-8 inline-flex w-fit items-center gap-2 text-sm text-[oklch(0.94_0.012_245)] hover:text-white"
						>
							{m.docs}
							<CaretRight aria-hidden="true" className="size-4" />
						</Link>
						<p className="mt-5 text-xs text-neutral-500 leading-relaxed">{m.availability}</p>
					</div>
					<section
						id={id}
						ref={pane}
						aria-label={details.title}
						className="relative isolate order-1 lg:order-2 min-h-[30rem] min-w-0 overflow-hidden bg-[oklch(0.12_0.002_286)] p-6 sm:p-9"
					>
						<Link
							href={`https://github.com/maschina-labs/maschina/blob/main/${sample.path}`}
							target="_blank"
							rel="noreferrer"
							className="relative z-20 mb-8 flex items-start justify-between gap-4 break-all text-xs text-neutral-500 hover:text-neutral-200"
						>
							<span>{sample.path}</span>
							<CaretRight aria-hidden="true" className="size-4 shrink-0" />
						</Link>
						<div className="sr-only">
							<Source code={sample.code} />
						</div>
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 overflow-hidden px-6 pt-20 sm:px-9 [mask-image:linear-gradient(to_bottom,transparent,black_16%,black_80%,transparent)]"
						>
							<div
								key={sample.path}
								className="animate-stream motion-reduce:animate-none"
								style={{ animationPlayState: visible && !paused ? "running" : "paused" }}
							>
								<div className="pb-12 opacity-70">
									<Source code={streamingSource} />
								</div>
								<div className="pb-12 opacity-70">
									<Source code={streamingSource} />
								</div>
							</div>
						</div>
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(135deg,oklch(0.95_0.008_245/0.06),oklch(0.15_0_0/0.2)_45%,oklch(0.8_0.008_245/0.04))] backdrop-blur-[1px]"
						/>
						<button
							type="button"
							aria-label={paused ? m.resume : m.pause}
							aria-pressed={paused}
							onClick={() => setPaused((value) => !value)}
							className="absolute right-6 bottom-6 z-20 grid size-9 place-items-center bg-[oklch(0.2_0_0/0.75)] text-neutral-300 backdrop-blur-xl hover:bg-white/15 hover:text-white sm:right-9 sm:bottom-9"
						>
							{paused ? (
								<Play aria-hidden="true" className="size-4" />
							) : (
								<Pause aria-hidden="true" className="size-4" />
							)}
						</button>
					</section>
				</div>
				<div className="mt-6 flex flex-col items-center gap-6 text-center text-xs text-neutral-500">
					<p>{m.license}</p>
					<Link
						href="https://github.com/maschina-labs/maschina"
						className="silver-button flex min-h-12 w-full items-center justify-center px-6 py-3 text-sm text-black sm:w-fit"
					>
						{m.source}
					</Link>
				</div>
			</div>
		</section>
	);
}
