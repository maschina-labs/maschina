import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NewMachine } from "../components/new-machine.tsx";
import { Copy, Page, Part } from "../components/page.tsx";

export const Route = createFileRoute("/new")({
	component: NewPage,
});

/** Making a machine, on its own page: kind, paper or live, its settings, and what it will cost. */
function NewPage() {
	const navigate = useNavigate();
	return (
		<Page code="MACHINES // NEW" title="MAKE A MACHINE">
			<div className="max-w-[640px]">
				<NewMachine
					onCreated={(machineId) => navigate({ to: "/machines/$machineId", params: { machineId } })}
				/>
			</div>
			<Part title="WHAT IT COSTS">
				<Copy>
					PAPER MACHINES ARE FREE. A LIVE MACHINE PAYS A SMALL MONTHLY FEE WHILE IT RUNS, AND A
					SMALL SHARE OF EACH TRADE, TAKEN INSIDE THE SWAP. THE EXACT NUMBERS ARE SET WHEN BILLING
					IS BUILT, AND SHOWN HERE BEFORE ANYTHING STARTS.
				</Copy>
			</Part>
		</Page>
	);
}
