import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "../components/portfolio.tsx";

export const Route = createFileRoute("/activity")({
	component: Page,
});

/** Plain for now: every piece exposed first, arranged and styled afterwards. */
function Page() {
	return (
		<div className="flex w-full flex-col gap-10 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500">ACTIVITY</h1>
			<Activity />
			<p className="text-[11px] text-neutral-600">
				COMING: FILTERS, AND WHY EACH MACHINE DID WHAT IT DID
			</p>
		</div>
	);
}
