import { describe, expect, it, vi } from "vitest";
import { peopleApi } from "./people-api.ts";

const GATEWAY = "https://api.maschina.dev";

function api(answer: Response | Error) {
	const call = vi.fn(async () => {
		if (answer instanceof Error) throw answer;
		return answer;
	});
	return { api: peopleApi(GATEWAY, call as unknown as typeof fetch), call };
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function sent(call: ReturnType<typeof vi.fn>) {
	const [url, init] = call.mock.calls[0] as unknown as [string, RequestInit];
	return { url, init, body: JSON.parse((init.body as string) ?? "null") };
}

describe("signing in with an email and a password", () => {
	it("asks the gateway, sends the cookie along, and says it worked", async () => {
		const { api: people, call } = api(json({ user: { id: "u" } }));
		expect(await people.signInEmail("a@example.com", "pw")).toEqual({ ok: true });
		const { url, init, body } = sent(call);
		expect(url).toBe("https://api.maschina.dev/v1/auth/people/sign-in/email");
		expect(init.method).toBe("POST");
		expect(init.credentials).toBe("include");
		expect(body).toEqual({ email: "a@example.com", password: "pw" });
	});

	it("says in plain words when the address has not been confirmed", async () => {
		const { api: people } = api(json({ code: "EMAIL_NOT_VERIFIED", message: "x" }, 403));
		const result = await people.signInEmail("a@example.com", "pw");
		expect(result).toMatchObject({ ok: false, code: "EMAIL_NOT_VERIFIED" });
		expect(!result.ok && result.message).toMatch(/confirm/i);
	});

	it("does not say whether it was the address or the password that was wrong", async () => {
		const { api: people } = api(json({ code: "INVALID_EMAIL_OR_PASSWORD", message: "x" }, 401));
		const result = await people.signInEmail("a@example.com", "pw");
		expect(!result.ok && result.message).toBe("That email and password do not match.");
	});

	it("says it could not be reached when the network fails, and when the answer is not JSON", async () => {
		const down = await api(new Error("offline")).api.signInEmail("a@example.com", "pw");
		expect(down).toMatchObject({ ok: false, code: "offline" });
		const html = await api(new Response("<html>", { status: 502 })).api.signInEmail("a@b.c", "pw");
		expect(html).toMatchObject({ ok: false, code: "unavailable" });
	});

	it("says too many tries when the gateway slows it down", async () => {
		const result = await api(json({}, 429)).api.signInEmail("a@example.com", "pw");
		expect(result).toMatchObject({ ok: false, code: "slow_down" });
	});
});

describe("making an account", () => {
	it("sends the name, address and password, and where the link in the email should lead", async () => {
		const { api: people, call } = api(json({ user: { id: "u" } }));
		expect(
			await people.signUpEmail(
				"Ash",
				"a@example.com",
				"a long enough password",
				"https://auth.maschina.dev/verified",
			),
		).toEqual({ ok: true });
		expect(sent(call).url).toBe("https://api.maschina.dev/v1/auth/people/sign-up/email");
		expect(sent(call).body).toEqual({
			name: "Ash",
			email: "a@example.com",
			password: "a long enough password",
			callbackURL: "https://auth.maschina.dev/verified",
		});
	});

	it("passes on a plain reason when it is refused", async () => {
		const exists = await api(
			json({ code: "USER_ALREADY_EXISTS", message: "x" }, 422),
		).api.signUpEmail("A", "a@b.c", "a long enough password", "https://x/verified");
		expect(!exists.ok && exists.message).toMatch(/already/i);
		const short = await api(
			json({ code: "PASSWORD_TOO_SHORT", message: "x" }, 400),
		).api.signUpEmail("A", "a@b.c", "short", "https://x/verified");
		expect(!short.ok && short.message).toMatch(/10/);
	});
});

describe("choosing a new password", () => {
	it("asks for the email, naming the page the link should open", async () => {
		const { api: people, call } = api(json({ status: true }));
		expect(await people.requestReset("a@example.com", "https://auth.maschina.dev/reset")).toEqual({
			ok: true,
		});
		expect(sent(call).url).toBe("https://api.maschina.dev/v1/auth/people/request-password-reset");
		expect(sent(call).body).toEqual({
			email: "a@example.com",
			redirectTo: "https://auth.maschina.dev/reset",
		});
	});

	it("sends the new password with the token from the link", async () => {
		const { api: people, call } = api(json({ status: true }));
		expect(await people.resetPassword("tok", "a brand new password")).toEqual({ ok: true });
		expect(sent(call).body).toEqual({ token: "tok", newPassword: "a brand new password" });
	});

	it("says the link is no good when it has expired", async () => {
		const result = await api(json({ code: "INVALID_TOKEN", message: "x" }, 400)).api.resetPassword(
			"t",
			"p",
		);
		expect(!result.ok && result.message).toMatch(/expired|new link/i);
	});
});

describe("signing in with Google, GitHub or a company", () => {
	it("gets the address to send the person to", async () => {
		const { api: people, call } = api(
			json({ url: "https://accounts.google.com/x", redirect: true }),
		);
		expect(await people.startSocial("google", "https://app.maschina.dev")).toEqual({
			ok: true,
			url: "https://accounts.google.com/x",
		});
		expect(sent(call).url).toBe("https://api.maschina.dev/v1/auth/people/sign-in/social");
		expect(sent(call).body).toEqual({
			provider: "google",
			callbackURL: "https://app.maschina.dev",
		});
	});

	it("finds a company's provider by the email's domain", async () => {
		const { api: people, call } = api(
			json({ url: "https://company.okta.com/sso", redirect: true }),
		);
		expect(await people.startSso("a@company.com", "https://app.maschina.dev")).toEqual({
			ok: true,
			url: "https://company.okta.com/sso",
		});
		expect(sent(call).url).toBe("https://api.maschina.dev/v1/auth/people/sign-in/sso");
		expect(sent(call).body).toMatchObject({ email: "a@company.com" });
	});

	it("says so when there is nothing to go to", async () => {
		const result = await api(json({}, 200)).api.startSocial("github", "https://app.maschina.dev");
		expect(result).toMatchObject({ ok: false });
	});
});
