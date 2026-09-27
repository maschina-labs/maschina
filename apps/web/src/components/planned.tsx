/**
 * A screen that is in the product but not built yet.
 *
 * It says so plainly and says what will be here, because a page of invented numbers is worse than an
 * honest gap: somebody would read it, believe it, and be wrong. Nothing in Maschina shows a figure the
 * record cannot produce, and that rule does not bend for a screen that looks empty.
 *
 * Each one names the thing it is waiting on, so the page doubles as a roadmap you can walk through.
 */

import type { Icon } from "@phosphor-icons/react";
import { Shell } from "./shell.tsx";
import { PageHead, Pill } from "./ui.tsx";

export function Planned({
	icon: Glyph,
	title,
	note,
	will,
	waiting,
}: {
	icon: Icon;
	title: string;
	note: string;
	/** What this screen will show, once it can. */
	will: string[];
	/** The thing that has to exist first, in plain words. */
	waiting: string;
}) {
	return (
		<Shell>
			<PageHead title={title} note={note} actions={<Pill tone="quiet">not built yet</Pill>} />
			<div className="mx-auto w-full max-w-[1180px] px-7 py-8">
				<div className="max-w-[560px] rounded-lg border border-line border-dashed bg-surface/40 p-6">
					<div className="flex size-8 items-center justify-center rounded-md border border-line bg-inset text-text-faint">
						<Glyph size={16} />
					</div>
					<p className="mt-4 font-medium text-[12px] text-text uppercase tracking-[0.08em]">
						What goes here
					</p>
					<ul className="mt-2.5 space-y-1.5">
						{will.map((line) => (
							<li key={line} className="flex gap-2.5 text-[12.5px] text-text-muted">
								<span className="mt-[7px] size-1 shrink-0 rounded-full bg-line-strong" />
								{line}
							</li>
						))}
					</ul>
					<p className="mt-5 border-line border-t pt-4 text-[12px] text-text-faint leading-relaxed">
						Waiting on {waiting}. Nothing is shown here until the record can produce it, because a
						number nobody can check is worse than no number.
					</p>
				</div>
			</div>
		</Shell>
	);
}
