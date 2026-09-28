import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Page, Part } from "../components/page.tsx";

export const Route = createFileRoute("/feedback")({
	component: Feedback,
});

/** Telling us what broke or what you want (#214). It opens your mail app, addressed and filled in. */
function Feedback() {
	const [kind, setKind] = useState<"BUG" | "IDEA">("BUG");
	const [text, setText] = useState("");
	const mail = `mailto:support@maschina.dev?subject=${encodeURIComponent(`${kind}: ${text.slice(0, 60)}`)}&body=${encodeURIComponent(`${text}\n\nPage: ${typeof window === "undefined" ? "" : window.location.href}`)}`;
	return (
		<Page code="SUPPORT // FEEDBACK" title="TELL US">
			<Part title="WHAT KIND">
				<fieldset className="flex gap-1.5">
					<legend className="sr-only">Kind</legend>
					{(["BUG", "IDEA"] as const).map((each) => (
						<button
							key={each}
							type="button"
							aria-pressed={kind === each}
							onClick={() => setKind(each)}
							className={`h-9 border px-4 text-[11px] tracking-[0.12em] ${kind === each ? "border-white/40 text-neutral-100" : "border-white/10 text-neutral-500"}`}
						>
							{each === "BUG" ? "SOMETHING BROKE" : "AN IDEA"}
						</button>
					))}
				</fieldset>
			</Part>
			<Part title="WHAT HAPPENED">
				<textarea
					value={text}
					onChange={(event) => setText(event.target.value)}
					aria-label="What happened"
					rows={6}
					className="max-w-[640px] border border-white/10 bg-transparent p-3 text-[12px] text-neutral-100 outline-none"
				/>
				<a
					href={mail}
					className="self-start border border-white/30 px-5 py-2.5 text-[11px] text-neutral-100 tracking-[0.14em] hover:bg-white/[0.06]"
				>
					SEND
				</a>
				<Copy>
					IT OPENS YOUR MAIL APP WITH THIS FILLED IN, SO NOTHING IS SENT UNTIL YOU PRESS SEND THERE.
				</Copy>
			</Part>
		</Page>
	);
}
