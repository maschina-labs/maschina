import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
	component: Page,
});

/** Plain for now: where the docs and the whitepaper will live, reached from the rail. */
function Page() {
	return (
		<div className="flex w-full flex-col gap-6 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500 tracking-[0.12em]">DOCS</h1>
			<p className="text-[12px] text-neutral-500">
				COMING: HOW MACHINES WORK, THE RULES THEY CANNOT BREAK, THE API, AND THE WHITEPAPER
			</p>
		</div>
	);
}
