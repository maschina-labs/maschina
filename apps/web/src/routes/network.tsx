import { createFileRoute } from "@tanstack/react-router";
import { Globe } from "../components/globe.tsx";

export const Route = createFileRoute("/network")({
	component: Page,
});

/** Where machines run. The globe first; the nodes on it come once the network reports where they are. */
function Page() {
	return (
		// Fits the screen exactly: the globe takes whatever height is left and never makes the page scroll.
		<div className="flex h-full w-full flex-col overflow-hidden px-2 py-6 sm:px-6 sm:py-10">
			<h1 className="text-[11px] text-neutral-500 tracking-[0.12em]">NETWORK</h1>
			<div className="min-h-0 w-full flex-1">
				<Globe />
			</div>
		</div>
	);
}
