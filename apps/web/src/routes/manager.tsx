import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ManagerView } from "../components/manager.tsx";
import { useMachines } from "../lib/machines.ts";
import { fetchPrice } from "../lib/price.ts";
import { useSession } from "../lib/session.ts";
import { suggestionsFor } from "../lib/suggestions.ts";

export const Route = createFileRoute("/manager")({
	component: Page,
});

/** The manager, reached from the sparkle in the left rail. */
function Page() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const price = useQuery({
		queryKey: ["sol-price"],
		queryFn: () => fetchPrice(),
		refetchInterval: 5_000,
	});
	const [dismissed, setDismissed] = useState<Set<string>>(new Set());
	const mine = session.data ? (machines.data ?? []) : [];
	const suggestions = suggestionsFor(mine, price.data?.usd).filter(
		(each) => !dismissed.has(each.id),
	);
	return (
		<div className="flex w-full flex-col gap-6 px-2 pt-6 pb-16 sm:px-6 sm:pt-10">
			<h1 className="text-[11px] text-neutral-500 tracking-[0.12em]">MANAGER</h1>
			<ManagerView
				suggestions={suggestions}
				onDismiss={(id) => setDismissed((was) => new Set([...was, id]))}
			/>
		</div>
	);
}
