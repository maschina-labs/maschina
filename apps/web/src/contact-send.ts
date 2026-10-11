/**
 * Who a message is for. These are the API's own topics (packages/contracts). They are written out here rather than
 * imported so the front pages do not carry the API's validation library; the API refuses any other.
 */
export const CONTACT_TOPICS = ["support", "billing", "legal", "abuse"] as const;

/** A message as the contact page sends it. */
export type ContactMessage = {
	topic: (typeof CONTACT_TOPICS)[number];
	name: string;
	email: string;
	message: string;
	website: string;
};

/** What happened to a message: it went, or the reason it did not, in the few ways a page needs to tell apart. */
export type Sent =
	| { ok: true }
	| { ok: false; reason: "invalid" | "limit" | "unavailable" | "network" };

/** Sends a message from the contact page to the API, which emails it to the right address. */
export async function sendMessage(
	api: string,
	message: ContactMessage,
	post: typeof fetch = fetch,
): Promise<Sent> {
	try {
		const response = await post(`${api}/v1/contact`, {
			method: "POST",
			headers: { "content-type": "application/json", accept: "application/json" },
			body: JSON.stringify(message),
		});
		if (response.ok) return { ok: true };
		if (response.status === 400) return { ok: false, reason: "invalid" };
		if (response.status === 429) return { ok: false, reason: "limit" };
		return { ok: false, reason: "unavailable" };
	} catch {
		return { ok: false, reason: "network" };
	}
}
