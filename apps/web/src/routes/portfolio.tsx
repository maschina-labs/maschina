import { createFileRoute } from "@tanstack/react-router";
import { Breakdown, Totals } from "../components/portfolio.tsx";

export const Route = createFileRoute("/portfolio")({
	component: Page,
});

/** Plain for now: every piece exposed first, arranged and styled afterwards. */
function Page() {
	return (
		<div className="flex w-full flex-col gap-10 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500">PORTFOLIO</h1>
			<Totals />
			<section aria-label="By machine">
				<h2 className="mb-3 text-[11px] text-neutral-500">BY MACHINE</h2>
				<Breakdown />
			</section>
			<p className="text-[11px] text-neutral-600">
				COMING: PROFIT AND LOSS OVER TIME, AND WHAT EACH VAULT HAS BANKED
			</p>
		</div>
	);
}
