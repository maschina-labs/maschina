/**
 * The contact desk: a message from the contact page, sent as one email through Resend to the role address for its
 * topic. The reply address is the person's own, so answering the mail answers them. The sender is the verified
 * `noreply@` address, never the person's, so the mail passes the checks every receiver runs.
 *
 * When Resend refuses or cannot be reached, the caller is told only that it is unavailable. What Resend said is not
 * passed on: it can name the key or the account.
 */

import type { ContactMessage } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";

export type ContactDesk = { send(message: ContactMessage): Promise<void> };

const ENDPOINT = "https://api.resend.com/emails";
const FROM = "Maschina contact form <noreply@maschina.dev>";
/** A slow answer from Resend should not hold a visitor's page open. */
const TIMEOUT_MS = 10_000;

export function contactDesk(options: {
	apiKey: string;
	fetch?: typeof globalThis.fetch;
}): ContactDesk {
	const call = options.fetch ?? globalThis.fetch;
	return {
		async send(message) {
			let response: Response;
			try {
				response = await call(ENDPOINT, {
					method: "POST",
					headers: {
						authorization: `Bearer ${options.apiKey}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({
						from: FROM,
						to: [`${message.topic}@maschina.dev`],
						reply_to: message.email,
						subject: `[${message.topic}] ${message.name}`,
						text: `From: ${message.name} <${message.email}>\nTopic: ${message.topic}\n\n${message.message}\n`,
					}),
					signal: AbortSignal.timeout(TIMEOUT_MS),
				});
			} catch (cause) {
				throw new MaschinaError("unavailable", "the message could not be sent", { cause });
			}
			if (!response.ok)
				throw new MaschinaError("unavailable", "the message could not be sent", {
					details: { status: response.status },
				});
		},
	};
}
