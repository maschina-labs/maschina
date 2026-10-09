import { Fragment } from "react";

/**
 * The machine SDK's real surface, as it stands in packages/sdk: `defineMachineKind` takes an id, a label, the
 * settings a kind accepts, and a `decide` that looks at the state and proposes to act or to skip, with a reason.
 * The sample is shown exactly as written here, so what is on screen is what is pinned in the tests.
 */
export const SAMPLE = `import { defineMachineKind } from "@maschina/sdk";
import { z } from "zod";

type Settings = { dropPercent: number };
type State = { drop: number };

// Buys when the price has dropped enough.
export const dipBuyer = defineMachineKind<Settings, State, "buy">({
  id: "dip-buyer",
  label: "Dip buyer",
  settings: z.object({ dropPercent: z.number() }),
  decide({ settings, state }) {
    if (state.drop < settings.dropPercent) {
      return { kind: "skip", reason: "Not down enough yet." };
    }
    return { kind: "act", action: "buy", reason: \`Down \${state.drop}%.\` };
  },
});`;

const POINTS = [
	{
		title: "A kind is data.",
		text: "The settings it accepts, and one function that looks at the state and proposes what to do.",
	},
	{
		title: "It can only propose.",
		text: "It never signs, never writes the record and never widens its own limits.",
	},
	{
		title: "Same rules for everyone.",
		text: "Your kind runs under the same budget, limits, wallet policy and permanent record as every built-in machine.",
	},
] as const;

/** Light colors for the code, the page's own step colors; everything else stays gray. */
const TOKEN =
	/(\/\/.*$)|("[^"]*"|`[^`]*`)|\b(import|from|export|const|type|return|if)\b|\b(defineMachineKind|Settings|State)\b/g;

function Line({ text }: { text: string }) {
	const pieces: React.ReactNode[] = [];
	let from = 0;
	for (const match of text.matchAll(TOKEN)) {
		const start = match.index ?? 0;
		if (start > from) pieces.push(text.slice(from, start));
		const [token, comment, string, keyword] = match;
		const color = comment
			? "text-neutral-500"
			: string
				? "text-[oklch(0.82_0.17_150)]"
				: keyword
					? "text-[oklch(0.8_0.11_300)]"
					: "text-[oklch(0.83_0.1_215)]";
		pieces.push(
			<span key={start} className={color}>
				{token}
			</span>,
		);
		from = start + token.length;
	}
	if (from < text.length) pieces.push(text.slice(from));
	return <>{pieces}</>;
}

/** The sample's lines, each with a key of its own, so the code can be drawn without index keys. */
const LINES = SAMPLE.split("\n").map((text, n) => ({ id: `line-${n}`, text }));

export function Builders() {
	return (
		<section aria-label="For builders" className="relative bg-black px-(--gutter) py-32">
			<h2 className="max-w-[40ch] font-display font-normal text-[clamp(2rem,4vw,4rem)] leading-[1.02] tracking-[-0.035em]">
				<span className="text-white">Build your own kind of machine.</span>{" "}
				<span className="text-neutral-500">
					It can only propose. Maschina holds the keys, checks the limits and writes the record.
				</span>
			</h2>
			<div className="mt-16 grid gap-12 lg:grid-cols-[1fr_1.5fr]">
				<div>
					<ul aria-label="What to know" className="flex flex-col gap-10">
						{POINTS.map((point) => (
							<li key={point.title}>
								<h3 className="text-[22px] text-white leading-tight tracking-[-0.02em]">
									{point.title}
								</h3>
								<p className="mt-3 max-w-[44ch] text-[15px] text-neutral-400 leading-snug">
									{point.text}
								</p>
							</li>
						))}
					</ul>
					<a
						href="/docs"
						className="mt-10 inline-flex h-9 items-center bg-white/[0.13] px-5 text-[15px] text-neutral-200 transition-colors hover:bg-white/[0.18]"
					>
						Read the docs
					</a>
				</div>
				<figure aria-label="A machine kind written with the SDK" className="min-w-0">
					<div className="flex h-9 items-center justify-between bg-[oklch(0.2_0.004_285)] px-4 text-[13px] text-neutral-400">
						<span>SDK preview. Not published yet.</span>
						<span>TypeScript</span>
					</div>
					<pre className="overflow-x-auto bg-[oklch(0.14_0.006_285)] p-5 font-mono text-[13px] text-neutral-300 leading-relaxed sm:p-6 sm:text-[14px]">
						<code>
							{LINES.map((line, n) => (
								<Fragment key={line.id}>
									{n > 0 ? "\n" : null}
									<Line text={line.text} />
								</Fragment>
							))}
						</code>
					</pre>
				</figure>
			</div>
		</section>
	);
}
