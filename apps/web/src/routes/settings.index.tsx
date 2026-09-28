import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "../components/settings.tsx";

export const Route = createFileRoute("/settings/")({
	component: Page,
});

/** Settings, reached from the gear at the bottom of the left rail. */
function Page() {
	return (
		<div className="flex w-full flex-col gap-6 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500 tracking-[0.12em]">SETTINGS</h1>
			<Settings />
		</div>
	);
}
