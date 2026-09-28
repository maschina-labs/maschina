import { createFileRoute } from "@tanstack/react-router";
import { MachinePanel } from "../components/machine-panel.tsx";

export const Route = createFileRoute("/machines/$machineId")({
	component: Page,
});

/** Plain for now: every piece exposed first, arranged and styled afterwards. */
function Page() {
	const { machineId } = Route.useParams();
	return (
		<div className="w-full px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<MachinePanel machineId={machineId} />
		</div>
	);
}
