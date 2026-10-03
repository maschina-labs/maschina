import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useSession, useSignIn } from "../lib/session.ts";
import { toast } from "../lib/toasts.ts";

/**
 * The first run, on Home, for anyone without a machine at work yet: connect, make a machine on paper,
 * start it, then watch it. Each step lights as it is done and the next one carries its button. It goes
 * away for good once any machine has started.
 */

type Machine = { machineId: string; state: "draft" | "ready" | "running" | "paused" | "stopped" };

/** Which step someone is on, or nothing once they are past the first run (or it is not known yet). */
export function firstRunStep({
	signedIn,
	machines,
}: {
	signedIn: boolean;
	machines: Machine[] | undefined;
}): { step: 1 | 2 } | { step: 3; machineId: string } | undefined {
	if (!signedIn) return { step: 1 };
	if (!machines) return undefined;
	if (machines.some((each) => ["running", "paused", "stopped"].includes(each.state)))
		return undefined;
	const made = machines[0];
	return made ? { step: 3, machineId: made.machineId } : { step: 2 };
}

const STEPS = [
	{ name: "Connect your wallet", says: "It signs you in. Nothing is spent." },
	{ name: "Make a range finder, on paper", says: "Real prices, no money moves." },
	{ name: "Start it", says: "It watches SOL and trades its band." },
	{ name: "Watch it here", says: "Every decision lands on Home." },
];

const ACTION =
	"inline-flex shrink-0 bg-white px-3.5 py-2 font-display text-[14px] text-neutral-950 disabled:opacity-40";

export function StartHere({ at }: { at: NonNullable<ReturnType<typeof firstRunStep>> }) {
	const { api } = useRouter().options.context;
	const queryClient = useQueryClient();
	const session = useSession(api);
	const signIn = useSignIn(api, queryClient);

	const action =
		at.step === 1 ? (
			<button
				type="button"
				disabled={session.isPending || signIn.isPending}
				onClick={() =>
					signIn.mutate(undefined, {
						onError: (error) =>
							// Closing the wallet picker is a choice, not a problem worth a message.
							error.name === "NoWalletChosen" ? undefined : toast(error.message, "problem"),
					})
				}
				className={ACTION}
			>
				{signIn.isPending ? "Check your wallet" : "Connect"}
			</button>
		) : !("machineId" in at) ? (
			<Link to="/new" className={ACTION}>
				Make it
			</Link>
		) : (
			<Link to="/machines/$machineId" params={{ machineId: at.machineId }} className={ACTION}>
				Open it to start
			</Link>
		);

	return (
		<div className="flex h-full flex-col justify-between gap-2 overflow-hidden p-4">
			<ol className="flex min-h-0 flex-col gap-1.5 @[18rem]:gap-2.5">
				{STEPS.map((step, index) => {
					const number = index + 1;
					const done = number < at.step;
					const now = number === at.step;
					return (
						<li key={step.name} className="flex gap-2.5">
							<span
								className={`w-3 font-display text-[14px] tabular-nums ${now ? "text-neutral-100" : "text-neutral-600"}`}
							>
								{done ? "✓" : number}
							</span>
							<span className="flex flex-col">
								<span
									className={`font-display text-[14px] leading-tight @[18rem]:text-[16px] ${now ? "text-neutral-100" : done ? "text-neutral-500 line-through" : "text-neutral-500"}`}
								>
									{step.name}
								</span>
								{now ? (
									<span className="text-[12px] text-neutral-400 leading-snug">{step.says}</span>
								) : null}
							</span>
						</li>
					);
				})}
			</ol>
			<div className="flex items-end justify-between gap-3">
				{action}
				<span className="text-[13px] text-neutral-500">Start here</span>
			</div>
		</div>
	);
}
