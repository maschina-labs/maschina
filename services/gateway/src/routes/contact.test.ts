import { ContactReceipt } from "@maschina/contracts";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.ts";

const logger = createLogger({ service: "test", level: "silent" });

const valid = {
	topic: "support",
	name: "Ada Lovelace",
	email: "ada@example.com",
	message: "My machine stopped trading this morning.",
};

function app(send?: (message: unknown) => Promise<void>) {
	return buildApp({
		version: "1.0.0",
		corsOrigins: ["http://localhost:3000"],
		logger,
		contact: send ? { send } : undefined,
		machines: {} as never,
		auth: { ownerOf: async () => undefined } as never,
		cookie: { secure: false },
	});
}

const post = (a: ReturnType<typeof app>, body: unknown) =>
	a.request("/v1/contact", {
		method: "POST",
		headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" },
		body: JSON.stringify(body),
	});

describe("the contact API", () => {
	it("sends a valid message, for anyone with no sign in, and says so", async () => {
		const send = vi.fn(async () => {});
		const res = await post(app(send), valid);
		expect(res.status).toBe(200);
		expect(ContactReceipt.parse(await res.json())).toEqual({ sent: true });
		expect(send).toHaveBeenCalledOnce();
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({ topic: "support", email: "ada@example.com" }),
		);
	});

	it("refuses what is not a message: a bad address, a message too short, a topic that is not offered, a line break in the name, extra fields", async () => {
		const send = vi.fn(async () => {});
		for (const bad of [
			{ ...valid, email: "not-an-email" },
			{ ...valid, message: "hi" },
			{ ...valid, topic: "security" },
			{ ...valid, topic: "founder" },
			{ ...valid, name: "Ada\r\nBcc: someone@example.com" },
			{ ...valid, extra: "x" },
		]) {
			expect((await post(app(send), bad)).status, JSON.stringify(bad)).toBe(400);
		}
		expect(send).not.toHaveBeenCalled();
	});

	it("drops a message from a program that filled the hidden field, and still says it was sent, so the program learns nothing", async () => {
		const send = vi.fn(async () => {});
		const res = await post(app(send), { ...valid, website: "http://spam.example" });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ sent: true });
		expect(send).not.toHaveBeenCalled();
	});

	it("says plainly that it is not switched on where no mail is set up, rather than pretending to send", async () => {
		const res = await post(app(), valid);
		expect(res.status).toBe(503);
	});

	it("passes on that sending failed, as unavailable, without showing why", async () => {
		const { MaschinaError } = await import("@maschina/core");
		const res = await post(
			app(async () => {
				throw new MaschinaError("unavailable", "mail could not be sent");
			}),
			valid,
		);
		expect(res.status).toBe(503);
	});

	it("allows a few messages a minute from one address, not a flood", async () => {
		const send = vi.fn(async () => {});
		const a = app(send);
		const statuses = [];
		for (let i = 0; i < 5; i++) statuses.push((await post(a, valid)).status);
		expect(statuses).toEqual([200, 200, 200, 429, 429]);
		expect(send).toHaveBeenCalledTimes(3);
	});
});
