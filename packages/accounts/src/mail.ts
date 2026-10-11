/**
 * Mail for the people signing in: the link that proves an address is theirs, and the one that lets them choose a new
 * password. Both go out through Resend from the verified `noreply@` address. A caller is told only that sending
 * failed: what Resend answers can name the key or the account, and is not passed on.
 */

import { MaschinaError } from "@maschina/core";

export type Mail = { to: string; subject: string; text: string };
export type Mailer = { send(mail: Mail): Promise<void> };

const ENDPOINT = "https://api.resend.com/emails";
const FROM = "Maschina <noreply@maschina.dev>";
/** A slow answer from Resend should not hold a sign in open. */
const TIMEOUT_MS = 10_000;

export function resendMailer(options: { apiKey: string; fetch?: typeof globalThis.fetch }): Mailer {
	const call = options.fetch ?? globalThis.fetch;
	return {
		async send(mail) {
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
						to: [mail.to],
						subject: mail.subject,
						text: mail.text,
					}),
					signal: AbortSignal.timeout(TIMEOUT_MS),
				});
			} catch (cause) {
				throw new MaschinaError("unavailable", "the email could not be sent", { cause });
			}
			if (!response.ok)
				throw new MaschinaError("unavailable", "the email could not be sent", {
					details: { status: response.status },
				});
		},
	};
}

/** Plain words, one link, and what to do if it was not them. */
export function verificationMail(to: string, url: string): Mail {
	return {
		to,
		subject: "Confirm your email for Maschina",
		text: `Open this link to confirm this email address for your Maschina account:\n\n${url}\n\nIf you did not make an account, ignore this message and nothing will happen.\n`,
	};
}

export function resetMail(to: string, url: string): Mail {
	return {
		to,
		subject: "Choose a new password for Maschina",
		text: `Open this link to choose a new password for your Maschina account:\n\n${url}\n\nIf you did not ask for this, ignore this message. Your password stays as it is.\n`,
	};
}
