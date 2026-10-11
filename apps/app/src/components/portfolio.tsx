import { useQueries } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { standings, type Window } from "../lib/leaderboard.ts";
import { recordQueryFor, useMachines } from "../lib/machines.ts";
import { activityOf, onPaper } from "../lib/portfolio.ts";
import { useSession } from "../lib/session.ts";
import { useSide } from "../lib/side.ts";
import { tradesFrom } from "../lib/trades.ts";

/** The signed in owner's machines and every record, read once for whichever half a page shows. */
function useEverything() {
	const { api } = useRouter().options.context;
	const session = useSession(api);
	const machines = useMachines(api);
	const records = useQueries({
		queries: (machines.data ?? []).map((machine) => recordQueryFor(api, machine.machineId)),
	});
	const signedIn = Boolean(session.data);
	const feed = activityOf(
		(machines.data ?? []).map((machine, index) => ({
			machine,
			events: records[index]?.data ?? [],
		})),
		500,
	);
	const all = records.map((record) => record.data ?? []);
	return { signedIn, machines: machines.data, feed, records: all };
}

/** Every machine's record as one feed, newest first; empty until someone is signed in. */
export function useActivity() {
	const { signedIn, feed } = useEverything();
	return signedIn ? feed : [];
}

/** Every trade your machines made, newest first, for the machine tape. */
export function useMachineTrades() {
	const { signedIn, machines, records } = useEverything();
	if (!signedIn || !machines) return [];
	return machines
		.flatMap((machine, index) =>
			tradesFrom(records[index] ?? []).map((trade) => ({
				...trade,
				machine: machine.name.toUpperCase(),
			})),
		)
		.sort((a, b) => b.at - a.at)
		.slice(0, 20);
}

/** Your machines, ranked for the leaderboard over a window. */
export function useStandings() {
	const { signedIn, machines, records } = useEverything();
	return (window: Window) =>
		signedIn && machines
			? standings(
					machines.map((machine, index) => ({ machine, record: records[index] ?? [] })),
					window,
				)
			: [];
}

/** Every machine with its record, for the operating picture. */
export function useOperatingPicture() {
	const { signedIn, machines, records } = useEverything();
	return signedIn && machines
		? machines.map((machine, index) => ({ machine, record: records[index] ?? [] }))
		: [];
}

/**
 * The machines on the side being shown, live by default, for every number that is money. Paper is a
 * sandbox on live markets: its figures never reach a live total, and live ones never reach paper (D-096).
 */
export function useSidePicture() {
	const side = useSide();
	return useOperatingPicture().filter(({ machine }) => onPaper(machine) === (side === "paper"));
}
