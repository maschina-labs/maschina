import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({
	component: Page,
});

/** Plain for now: the place settings will live, reached from the rail. */
function Page() {
	return (
		<div className="flex w-full flex-col gap-6 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500 tracking-[0.12em]">SETTINGS</h1>
			<p className="text-[12px] text-neutral-500">
				COMING: YOUR WALLETS, ALERTS, AND LATER YOUR OWN AI KEY
			</p>
		</div>
	);
}
