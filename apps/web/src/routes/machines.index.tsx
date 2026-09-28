import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fleet } from "../components/fleet.tsx";
import { Page, Part } from "../components/page.tsx";

export const Route = createFileRoute("/machines/")({
	component: Machines,
});

/** Your fleet. Making one has its own page now, one press away. */
function Machines() {
	const navigate = useNavigate();
	const open = (machineId: string) =>
		navigate({ to: "/machines/$machineId", params: { machineId } });
	return (
		<Page code="MACHINES // FLEET" title="YOUR MACHINES">
			<Link
				to="/new"
				className="self-start border border-white/30 px-4 py-2 text-[11px] text-neutral-100 tracking-[0.14em] hover:bg-white/[0.06]"
			>
				+ MAKE A MACHINE
			</Link>
			<Part title="ALL MACHINES">
				<Fleet selected={undefined} onSelect={open} />
			</Part>
		</Page>
	);
}
