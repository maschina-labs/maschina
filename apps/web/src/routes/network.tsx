import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coordinates } from "../components/coordinates.tsx";
import { Globe } from "../components/globe.tsx";
import { Scramble } from "../components/scramble.tsx";

export const Route = createFileRoute("/network")({
	component: Page,
});

/** Where machines run. The globe first; the nodes on it come once the network reports where they are. */
function Page() {
	const [centre, setCentre] = useState({ lat: 18, lng: 0 });
	return (
		// Fits the screen exactly: the globe takes whatever height is left and never makes the page scroll.
		<div className="relative flex h-full w-full flex-col overflow-hidden px-2 py-6 sm:px-6 sm:py-10">
			<div className="flex items-start justify-between gap-6">
				<div className="flex flex-col gap-2">
					<Scramble text="NETWORK" className="text-[11px] text-neutral-500 tracking-[0.14em]" />
					<Scramble
						text="THE NETWORK, LIVE"
						className="text-[18px] text-neutral-100 tracking-[0.1em]"
					/>
				</div>
				<Coordinates target={centre} />
			</div>
			<div className="min-h-0 w-full flex-1">
				<Globe onView={setCentre} />
			</div>
		</div>
	);
}
