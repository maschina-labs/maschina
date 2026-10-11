import { useEffect, useState } from "react";
import { STATUS } from "./links.ts";

/** Whether Maschina is up, read from the status page's own feed rather than claimed. */
export type Status =
	| { state: "checking" }
	| { state: "up" }
	| { state: "paused"; reason: string }
	| { state: "down" };

/**
 * The status page's feed: the same answer its page shows, kept by Better Stack from outside our own servers, so the
 * footer and the page cannot disagree. It is open to any browser.
 */
const FEED = `${STATUS}/index.json`;

/** How often the footer asks again while the page is open. Short enough that the TX and RX lights breathe. */
const EVERY_MS = 10_000;

/** Called as the traffic really happens: a request leaves (TX), an answer of any kind arrives (RX). */
export type Traffic = { onSend?: () => void; onReceive?: () => void };

export async function readStatus(
	feed: string,
	get: typeof fetch = fetch,
	traffic: Traffic = {},
): Promise<Status> {
	try {
		traffic.onSend?.();
		const response = await get(feed, { headers: { accept: "application/json" } });
		traffic.onReceive?.();
		// A feed that cannot be read says nothing about Maschina: the footer says it is still checking, not that it is down.
		if (!response.ok) return { state: "checking" };
		const body = (await response.json()) as {
			data?: { attributes?: { aggregate_state?: string } };
		};
		const state = body.data?.attributes?.aggregate_state;
		if (state === undefined) return { state: "checking" };
		if (state === "operational") return { state: "up" };
		if (state === "maintenance") return { state: "paused", reason: "maintenance" };
		// Degraded, down, or anything new: never called fine.
		return { state: "down" };
	} catch {
		return { state: "checking" };
	}
}

/** The status, and how many requests have gone out (tx) and how many answers have come back (rx). */
export function useStatus(feed = FEED): { status: Status; tx: number; rx: number } {
	const [status, setStatus] = useState<Status>({ state: "checking" });
	const [tx, setTx] = useState(0);
	const [rx, setRx] = useState(0);
	useEffect(() => {
		let live = true;
		const check = () =>
			void readStatus(feed, fetch, {
				onSend: () => live && setTx((n) => n + 1),
				onReceive: () => live && setRx((n) => n + 1),
			}).then((next) => live && setStatus(next));
		check();
		const timer = setInterval(check, EVERY_MS);
		return () => {
			live = false;
			clearInterval(timer);
		};
	}, [feed]);
	return { status, tx, rx };
}
