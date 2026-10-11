import { describe, expect, it, vi } from "vitest";
import { sendMessage } from "./contact-send.ts";

const message = {
	topic: "support" as const,
	name: "Ada",
	email: "ada@example.com",
	message: "My machine stopped this morning.",
	website: "",
};

const answer = (status: number) =>
	vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status }));

describe("sending a message to the API", () => {
	it("posts the message as JSON to the contact route of the API", async () => {
		const post = answer(200);
		expect(
			await sendMessage("https://api.example", message, post as unknown as typeof fetch),
		).toEqual({
			ok: true,
		});
		const [url, init] = post.mock.calls[0] ?? [];
		expect(url).toBe("https://api.example/v1/contact");
		expect(init?.method).toBe("POST");
		expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
		expect(JSON.parse(String(init?.body))).toEqual(message);
	});

	it("tells the cases apart: not valid, too many, not available, and cannot be reached", async () => {
		const reason = async (status: number) =>
			(await sendMessage("https://a", message, answer(status) as unknown as typeof fetch)) as {
				ok: false;
				reason: string;
			};
		expect((await reason(400)).reason).toBe("invalid");
		expect((await reason(429)).reason).toBe("limit");
		expect((await reason(503)).reason).toBe("unavailable");
		expect((await reason(500)).reason).toBe("unavailable");
		const down = (async () => {
			throw new Error("offline");
		}) as unknown as typeof fetch;
		expect(await sendMessage("https://a", message, down)).toEqual({ ok: false, reason: "network" });
	});
});
