import { useEffect, useState } from "react";

/** Whether Maschina is up, read from the API's own status check rather than claimed. */
export type Status =
	| { state: "checking" }
	| { state: "up" }
	| { state: "paused"; reason: string }
	| { state: "down" };

/** Where the API lives: api.maschina.dev, or the local gateway while developing (.env). */
export const API = import.meta.env.VITE_GATEWAY_URL ?? "https://api.maschina.dev";

/** How often the footer asks again while the page is open. */
const EVERY_MS = 60_000;

export async function readStatus(api: string, get: typeof fetch = fetch): Promise<Status> {
	try {
		const response = await get(`${api}/v1/status`, { headers: { accept: "application/json" } });
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

export function useStatus(api = API): Status {
	const [status, setStatus] = useState<Status>({ state: "checking" });
	useEffect(() => {
		let live = true;
		const check = () => void readStatus(api).then((next) => live && setStatus(next));
		check();
		const timer = setInterval(check, EVERY_MS);
		return () => {
			live = false;
			clearInterval(timer);
		};
	}, [api]);
	return status;
}
