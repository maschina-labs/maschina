import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";
import { Tile, TileEmpty } from "./bento.tsx";
import { Coordinates } from "./coordinates.tsx";
import { Globe } from "./globe.tsx";

/**
 * Network: where machines run. The globe is the page, four across and all the way down, turned by
 * dragging it; beside it, the few figures that say how the network stands.
 */
export function NetworkTiles() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const [center, setCenter] = useState({ lat: 18, lng: 0 });
	const mine = session.data ? (machines.data ?? []) : undefined;

	return (
		<>
			<Tile size="hero" label="Globe">
				{/* Dragging the globe turns it; it never swipes the page. */}
				<div data-own-drag className="absolute inset-0">
					<Globe onView={setCenter} />
				</div>
				<div className="pointer-events-none absolute top-4 right-4">
					<Coordinates target={center} />
				</div>
				<span className="pointer-events-none absolute bottom-4 left-4 text-[13px] text-neutral-500">
					Network
				</span>
			</Tile>

			<Tile size="wide" label="Nodes online" to="/network/join">
				<TileEmpty>Nodes appear here once the network opens to other computers.</TileEmpty>
			</Tile>

			<Tile size="wide" label="Your machines running" {...(mine ? { to: "/fleet" } : {})}>
				{mine ? (
					<div className="flex h-full flex-col justify-between p-4">
						<span className="font-display text-[clamp(22px,15cqw,44px)] text-neutral-100 tabular-nums leading-none">
							{mine.filter((machine) => machine.state === "running").length}
							<span className="text-neutral-500"> of {mine.length}</span>
						</span>
						<span className="text-[13px] text-neutral-500">Your machines running</span>
					</div>
				) : (
					<TileEmpty>Connect to see your machines.</TileEmpty>
				)}
			</Tile>

			<Tile size="wide" label="Run a node" to="/network/join">
				<div className="flex h-full flex-col justify-between p-4">
					<span className="font-display text-[clamp(16px,5cqw,22px)] text-neutral-100">
						Run a node
					</span>
					<span className="text-[13px] text-neutral-500">Lend your computer to the network</span>
				</div>
			</Tile>
		</>
	);
}
