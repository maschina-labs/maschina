import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fleet } from "../components/fleet.tsx";
import { NewMachine } from "../components/new-machine.tsx";

export const Route = createFileRoute("/machines/")({
	component: Page,
});

/** Plain for now: every piece exposed first, arranged and styled afterwards. */
function Page() {
	const navigate = useNavigate();
	const open = (machineId: string) =>
		navigate({ to: "/machines/$machineId", params: { machineId } });
	return (
		<div className="grid w-full gap-10 px-2 pt-6 pb-16 sm:px-6 sm:pt-10 md:grid-cols-2">
			<section aria-label="Your machines">
				<h1 className="mb-3 text-[11px] text-neutral-500">MACHINES</h1>
				<Fleet selected={undefined} onSelect={open} />
			</section>
			<section aria-label="New machine">
				<h2 className="mb-3 text-[11px] text-neutral-500">NEW MACHINE</h2>
				<NewMachine onCreated={open} />
			</section>
		</div>
	);
}
