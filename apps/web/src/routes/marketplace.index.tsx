import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace/")({
	component: Page,
});

/** Plain for now: every piece exposed first, arranged and styled afterwards. */
function Page() {
	return (
		<div className="flex w-full flex-col gap-10 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500">MARKETPLACE</h1>
			<p className="text-[12px] text-neutral-500">
				COMING: MACHINES WITH A PROVEN RECORD, READY TO COPY WITH YOUR OWN BUDGET AND LIMITS
			</p>
		</div>
	);
}
