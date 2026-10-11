import { describe, expect, it, vi } from "vitest";
import { resendMailer, resetMail, verificationMail } from "./mail.ts";

const mail = { to: "a@example.com", subject: "s", text: "t" };

describe("the mailer", () => {
	it("sends one email through Resend from the verified address", async () => {
		const call = vi.fn(async () => new Response("{}", { status: 200 }));
		await resendMailer({ apiKey: "key", fetch: call as unknown as typeof fetch }).send(mail);
		const [url, init] = call.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.resend.com/emails");
		expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer key");
		expect(JSON.parse(init.body as string)).toMatchObject({
			from: "Maschina <noreply@maschina.dev>",
			to: ["a@example.com"],
			subject: "s",
		});
	});

	it("says only that it could not send when Resend refuses, and does not pass on what Resend said", async () => {
		const refused = vi.fn(async () => new Response("secret detail about the key", { status: 403 }));
		const sending = resendMailer({ apiKey: "k", fetch: refused as unknown as typeof fetch }).send(
			mail,
		);
		await expect(sending).rejects.toThrow("the email could not be sent");
		await expect(sending).rejects.not.toThrow(/secret/);
	});

	it("says the same when Resend cannot be reached", async () => {
		const down = vi.fn(async () => {
			throw new Error("network down");
		});
		await expect(
			resendMailer({ apiKey: "k", fetch: down as unknown as typeof fetch }).send(mail),
		).rejects.toThrow("the email could not be sent");
	});
});

describe("the mailer's own fetch", () => {
	it("uses the global one when none is given", async () => {
		const call = vi.fn(async () => new Response("{}", { status: 200 }));
		vi.stubGlobal("fetch", call);
		await resendMailer({ apiKey: "k" }).send(mail);
		expect(call).toHaveBeenCalledOnce();
	});
});

describe("the two emails", () => {
	it("carry the link and say what to do if it was not them", () => {
		const verify = verificationMail("a@example.com", "https://x/verify?t=1");
		expect(verify.to).toBe("a@example.com");
		expect(verify.text).toContain("https://x/verify?t=1");
		expect(verify.text).toContain("ignore");
		const reset = resetMail("a@example.com", "https://x/reset?t=2");
		expect(reset.text).toContain("https://x/reset?t=2");
		expect(reset.text).toContain("stays as it is");
	});
});
