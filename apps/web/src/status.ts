import { useEffect, useState } from "react";

/** Whether Maschina is up, read from the API's own status check rather than claimed. */
export type Status =
	| { state: "checking" }
	| { state: "up" }
	| { state: "paused"; reason: string }
	| { state: "down" };

/** Where the API lives: api.maschina.dev, or the local gateway while developing (.env). */
export const API = import.meta.env.VITE_GATEWAY_URL ?? "https://api.maschina.dev";

/** How often the footer asks again while the page is open. Short enough that the TX and RX lights breathe. */
const EVERY_MS = 10_000;

/** Called as the traffic really happens: a request leaves (TX), an answer of any kind arrives (RX). */
export type Traffic = { onSend?: () => void; onReceive?: () => void };

export async function readStatus(
	api: string,
	get: typeof fetch = fetch,
	traffic: Traffic = {},
): Promise<Status> {
	try {
		traffic.onSend?.();
		const response = await get(`${api}/v1/status`, { headers: { accept: "application/json" } });
		traffic.onReceive?.();
		if (!response.ok) return { state: "down" };
		const body = (await response.json()) as { status?: string; halt?: { reason?: string } };
		if (body.status !== "ok") return { state: "down" };
		// The stop switch: every machine is paused at the signer, and the API says why.
		if (body.halt) return { state: "paused", reason: body.halt.reason ?? "paused" };
		return { state: "up" };
	} catch {
		return { state: "down" };
	}
}

/** The status, and how many requests have gone out (tx) and how many answers have come back (rx). */
export function useStatus(api = API): { status: Status; tx: number; rx: number } {
	const [status, setStatus] = useState<Status>({ state: "checking" });
	const [tx, setTx] = useState(0);
	const [rx, setRx] = useState(0);
	useEffect(() => {
		let live = true;
		const check = () =>
			void readStatus(api, fetch, {
				onSend: () => live && setTx((n) => n + 1),
				onReceive: () => live && setRx((n) => n + 1),
			}).then((next) => live && setStatus(next));
		check();
		const timer = setInterval(check, EVERY_MS);
		return () => {
			live = false;
			clearInterval(timer);
		};
	}, [api]);
	return { status, tx, rx };
}
