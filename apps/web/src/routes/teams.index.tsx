import { createFileRoute } from "@tanstack/react-router";
import { Coming, Copy, Later, Page, Part } from "../components/page.tsx";

export const Route = createFileRoute("/teams/")({
	component: Teams,
});

/** Teams of machines that work together, each with a budget, talking in one conversation (A8). */
function Teams() {
	return (
		<Page code="TEAMS" title="YOUR TEAMS">
			<Part title="TEAMS">
				<Copy>NONE YET.</Copy>
			</Part>
			<Part title="WHAT A TEAM IS">
				<Copy>
					SEVERAL MACHINES WITH ONE PURPOSE AND ONE SHARED BUDGET, TALKING IN ONE CONVERSATION. YOU
					TALK TO THE TEAM, NOT EACH MACHINE.
				</Copy>
			</Part>
			<Later>MAKE A TEAM</Later>
			<Coming>TEAMS ARRIVE IN A8.</Coming>
		</Page>
	);
}
