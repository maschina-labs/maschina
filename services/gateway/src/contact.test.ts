import { MaschinaError } from "@maschina/core";
import { describe, expect, it, vi } from "vitest";
import { contactDesk } from "./contact.ts";

const message = {
	topic: "billing" as const,
	name: "Ada Lovelace",
	email: "ada@example.com",
	message: "I was charged twice for one machine.",
};

function desk(respond: () => Response = () => new Response('{"id":"abc"}', { status: 200 })) {
	const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => respond());
	return {
		fetch,
		desk: contactDesk({ apiKey: "re_test_key", fetch: fetch as typeof globalThis.fetch }),
	};
}

describe("the contact desk", () => {
	it("sends the message through Resend to the role address for its topic, and a reply goes to the person", async () => {
		const { fetch, desk: sender } = desk();
		await sender.send(message);
		expect(fetch).toHaveBeenCalledOnce();
		const [url, init] = fetch.mock.calls[0] ?? [];
		expect(url).toBe("https://api.resend.com/emails");
		expect(init?.method).toBe("POST");
		const headers = (init?.headers ?? {}) as Record<string, string>;
		expect(headers["authorization"]).toBe("Bearer re_test_key");
		const body = JSON.parse(String(init?.body));
		expect(body.to).toEqual(["billing@maschina.dev"]);
		expect(body.from).toBe("Maschina contact form <noreply@maschina.dev>");
		expect(body.reply_to).toBe("ada@example.com");
		expect(body.subject).toBe("[billing] Ada Lovelace");
		expect(body.text).toContain("I was charged twice for one machine.");
		expect(body.text).toContain("ada@example.com");
	});

	it("sends each topic to its own address, and nothing to a person's", async () => {
		for (const topic of ["support", "billing", "legal", "abuse"] as const) {
			const { fetch, desk: sender } = desk();
			await sender.send({ ...message, topic });
			expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).to).toEqual([
				`${topic}@maschina.dev`,
			]);
		}
	});

	it("says it is unavailable, without showing Resend's answer, when Resend refuses or cannot be reached", async () => {
		const refused = desk(() => new Response('{"message":"secret detail"}', { status: 403 }));
		await expect(refused.desk.send(message)).rejects.toMatchObject({ code: "unavailable" });
		await expect(refused.desk.send(message)).rejects.not.toThrow(/secret detail/);
		const down = contactDesk({
			apiKey: "k",
			fetch: (async () => {
				throw new Error("network");
			}) as typeof globalThis.fetch,
		});
		await expect(down.send(message)).rejects.toBeInstanceOf(MaschinaError);
	});
});
