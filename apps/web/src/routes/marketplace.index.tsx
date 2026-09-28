import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Leaderboard } from "../components/leaderboard.tsx";
import { MarketplaceView } from "../components/marketplace.tsx";
import { useStandings } from "../components/portfolio.tsx";
import { useMachines } from "../lib/machines.ts";
import { useSession } from "../lib/session.ts";

export const Route = createFileRoute("/marketplace/")({
	component: Page,
});

/** Plain for now: every piece exposed first, arranged and styled afterwards. */
function Page() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const mine = session.data ? (machines.data ?? []) : [];
	const rank = useStandings();
	return (
		<div className="flex w-full flex-col gap-10 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500">MARKETPLACE</h1>
			<Leaderboard rank={rank} />
			<MarketplaceView machines={mine} />
		</div>
	);
}
