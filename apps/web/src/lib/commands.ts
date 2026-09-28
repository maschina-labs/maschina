/**
 * What the command palette can do, and how a typed search narrows it. Plain data so it can be tested
 * without a screen: every page, every machine, and actions that work across machines.
 */

export type Command = {
	id: string;
	label: string;
	hint: string;
	to?: string;
	search?: Record<string, string>;
};

/** A command matches when every word typed appears in its label or hint, in any order. */
export function matches(command: Command, typed: string): boolean {
	const haystack = `${command.label} ${command.hint}`.toLowerCase();
	return typed
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => haystack.includes(word));
}

export function commandsFor(
	machines: { machineId: string; name: string; state: string }[],
): Command[] {
	const pages: Command[] = [
		{
			id: "terminal",
			label: "TERMINAL",
			hint: "PAGE · THE MARKET AND YOUR MACHINE AT WORK",
			to: "/",
		},
		{
			id: "intel",
			label: "INTEL",
			hint: "PAGE · THE OPERATING PICTURE: OBJECTS, LINKS, THE ANALYST",
			to: "/intel",
		},
		{
			id: "portfolio",
			label: "PORTFOLIO",
			hint: "PAGE · TOTALS AND PROFIT OVER TIME",
			to: "/portfolio",
		},
		{ id: "machines", label: "MACHINES", hint: "PAGE · YOUR FLEET", to: "/machines" },
		{ id: "new", label: "NEW MACHINE", hint: "CREATE · PAPER OR LIVE", to: "/new" },
		{
			id: "activity",
			label: "ACTIVITY",
			hint: "PAGE · EVERYTHING YOUR MACHINES DID",
			to: "/activity",
		},
		{ id: "swap", label: "SWAP", hint: "PAGE · SOL AND USDC THROUGH JUPITER", to: "/swap" },
		{ id: "marketplace", label: "MARKETPLACE", hint: "PAGE · PROVEN MACHINES", to: "/marketplace" },
		{ id: "network", label: "NETWORK", hint: "PAGE · THE GLOBE", to: "/network" },
		{
			id: "manager",
			label: "MANAGER",
			hint: "PAGE · SUGGESTIONS FOR YOUR MACHINES",
			to: "/manager",
		},
		{ id: "settings", label: "SETTINGS", hint: "PAGE · WALLETS, ALERTS, FEES", to: "/settings" },
	];
	const perMachine = machines.flatMap((machine) => [
		{
			id: `open-${machine.machineId}`,
			label: machine.name.toUpperCase(),
			hint: `MACHINE · ${machine.state.toUpperCase()} · OPEN ITS PAGE`,
			to: `/machines/${machine.machineId}`,
		},
		{
			id: `follow-${machine.machineId}`,
			label: `FOLLOW ${machine.name.toUpperCase()}`,
			hint: "TERMINAL · SHOW IT ON THE CHART",
			to: "/",
			search: { machine: machine.machineId },
		},
	]);
	return [...pages, ...perMachine];
}
