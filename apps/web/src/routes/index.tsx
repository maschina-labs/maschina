import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	const { api } = Route.useRouteContext();
	const status = useQuery({
		queryKey: ["status"],
		queryFn: async () => {
			const res = await api.v1.status.$get();
			if (!res.ok) throw Object.assign(new Error("status unavailable"), { status: res.status });
			return res.json();
		},
	});

	return (
		<section className="space-y-3">
			<h1 className="font-semibold text-3xl tracking-tight">Software that goes to work.</h1>
			<p className="text-muted-foreground">Machines are coming.</p>
			<p className="text-sm" data-testid="api-status">
				API:{" "}
				{status.isPending ? "checking" : status.isError ? "unreachable" : `${status.data.status}`}
			</p>
		</section>
	);
}
