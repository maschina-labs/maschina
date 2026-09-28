import { createFileRoute } from "@tanstack/react-router";
import { Coming, Page, Part } from "../components/page.tsx";

export const Route = createFileRoute("/teams/$teamId")({
	component: Team,
});

/** One team: its conversation, its machines and their budgets (A8). */
function Team() {
	const { teamId } = Route.useParams();
	return (
		<Page code={`TEAMS // ${teamId.slice(0, 8).toUpperCase()}`} title="A TEAM">
			<Part title="CONVERSATION">
				<Coming>THE TEAM'S GROUP CONVERSATION, WITH YOU IN IT.</Coming>
			</Part>
			<Part title="MACHINES">
				<Coming>ITS MACHINES AND WHAT EACH IS DOING.</Coming>
			</Part>
			<Part title="BUDGETS">
				<Coming>WHAT EACH MACHINE MAY SPEND, AND WHAT IS LEFT.</Coming>
			</Part>
		</Page>
	);
}
