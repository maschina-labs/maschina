/**
 * Telling owners what their machines did, on Telegram.
 *
 * Every little while the bots ask the orchestrator what these owners have not been told, send each one,
 * and say so once it is out. A message that fails to send is not marked, so it is tried again next time;
 * one that sent but could not be marked may be sent twice, which is the right way round to be wrong.
 *
 * Which Telegram chat belongs to which owner is configuration for now: Ash's own. Linking a chat from the
 * app is in TECH_DEBT.
 */

import { type Alert, PendingAlerts } from "@maschina/contracts";
import type { Logger } from "@maschina/telemetry";
import { alertText } from "./alert-text.ts";

export type AlertPorts = {
	/** The orchestrator's base URL and the bots' token for it. */
	orchestratorUrl: string;
	token: string;
	/** Which chat to tell, by owner. */
	chats: ReadonlyMap<string, string>;
	/** Sends a message to a chat. */
	send(chatId: string, text: string): Promise<void>;
	fetcher?: typeof fetch;
	logger: Logger;
	/** Only things that happened after this are told, so turning alerts on never replays history. */
	since: Date;
};

/** One look: fetch, send, mark. Returns how many went out. */
export async function tellOnce(ports: AlertPorts): Promise<number> {
	const fetcher = ports.fetcher ?? fetch;
	const owners = [...ports.chats.keys()];
	if (owners.length === 0) return 0;
	const query = new URLSearchParams({ channel: "telegram", since: ports.since.toISOString() });
	for (const owner of owners) query.append("owner", owner);
	const headers = { authorization: `Bearer ${ports.token}` };

	const res = await fetcher(`${ports.orchestratorUrl}/alerts/v1/pending?${query}`, { headers });
	if (!res.ok) throw new Error(`the orchestrator answered ${res.status} for pending alerts`);
	const { alerts } = PendingAlerts.parse(await res.json());

	let told = 0;
	for (const alert of alerts) {
		const chat = ports.chats.get(alert.ownerId);
		if (!chat) continue;
		try {
			await ports.send(chat, alertText(alert));
		} catch (error) {
			// Not marked, so it is tried again on the next look.
			ports.logger.warn({ err: error, eventId: alert.eventId }, "could not send an alert");
			continue;
		}
		await markTold(fetcher, ports, headers, alert);
		told += 1;
	}
	return told;
}

async function markTold(
	fetcher: typeof fetch,
	ports: AlertPorts,
	headers: Record<string, string>,
	alert: Alert,
) {
	const res = await fetcher(`${ports.orchestratorUrl}/alerts/v1/delivered`, {
		method: "POST",
		headers: { ...headers, "content-type": "application/json" },
		body: JSON.stringify({ eventId: alert.eventId, channel: "telegram" }),
	});
	if (!res.ok) {
		ports.logger.warn(
			{ eventId: alert.eventId, status: res.status },
			"sent, but not marked as told",
		);
	}
}

/** A Telegram bot's sender. */
export function telegramSender(botToken: string, fetcher: typeof fetch = fetch) {
	return async (chatId: string, text: string) => {
		const res = await fetcher(`https://api.telegram.org/bot${botToken}/sendMessage`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
		});
		if (!res.ok) throw new Error(`Telegram answered ${res.status}`);
	};
}

/** "ownerId=chatId,ownerId=chatId" as a map. */
export function chatsFrom(setting: string | undefined): Map<string, string> {
	const chats = new Map<string, string>();
	for (const pair of (setting ?? "").split(",")) {
		const [owner, chat] = pair.split("=").map((part) => part.trim());
		if (owner && chat) chats.set(owner, chat);
	}
	return chats;
}

/** Looks every `everyMs` until `signal` aborts. A bad look is logged and the next one carries on. */
export async function tellForever(
	ports: AlertPorts & { everyMs: number },
	signal: AbortSignal,
	sleep: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms)),
): Promise<void> {
	while (!signal.aborted) {
		try {
			const told = await tellOnce(ports);
			if (told > 0) ports.logger.info({ told }, "told owners what their machines did");
		} catch (error) {
			ports.logger.warn({ err: error }, "could not look for alerts");
		}
		await sleep(ports.everyMs);
	}
}
