/**
 * Reading, and saying honestly when it cannot.
 *
 * Every view in the environment needs the same three things: the current answer,
 * whether the control plane is reachable, and the previous answer left alone when
 * it is not. `ENVIRONMENT_PLAN` slice 1 settled that a lost connection is a
 * notice rather than an empty state, and this is where that is enforced once
 * rather than remembered in each panel.
 */

import { useCallback, useEffect, useState } from "react";

export type Connection =
	| { readonly state: "connecting" }
	| { readonly state: "connected" }
	| { readonly state: "lost"; readonly problem: string };

type Reader<T> = () => Promise<{ ok: true; value: T } | { ok: false; problem: string }>;

/**
 * Read something, and read it again when the log changes.
 *
 * It used to poll every two seconds, which meant the window was a second behind
 * on average and asked a hundred and eighty questions an hour to learn nothing.
 * The control plane says when the log gains something, so this reads on being
 * told.
 *
 * A slow interval stays underneath as a floor, because being told is not a
 * guarantee: `07-CONTEXT-MEMORY` has no bearing here but the same instinct does,
 * that a push nobody stored is a push that can be missed. If the stream drops
 * and reconnects, the next read catches whatever happened in between anyway,
 * since the read is of current state rather than of a delta.
 */
export function useReading<T>(read: Reader<T>, everyMs = 30_000) {
	const [value, setValue] = useState<T | null>(null);
	const [connection, setConnection] = useState<Connection>({ state: "connecting" });

	const refresh = useCallback(async () => {
		if (window.maschina === undefined) {
			setConnection({
				state: "lost",
				problem: "The preload bridge did not load, so this window can reach nothing.",
			});
			return;
		}
		const result = await read();
		if (result.ok) {
			setValue(result.value);
			setConnection({ state: "connected" });
		} else {
			// What is already on screen stays. It was true when it arrived, and
			// losing the connection does not make it false.
			setConnection({ state: "lost", problem: result.problem });
		}
	}, [read]);

	useEffect(() => {
		void refresh();
		const timer = setInterval(() => void refresh(), everyMs);
		const stop = window.maschina?.log.onRecorded(() => void refresh());
		return () => {
			clearInterval(timer);
			stop?.();
		};
	}, [refresh, everyMs]);

	return { value, connection, refresh } as const;
}
