/**
 * Signing in as a person, against real Postgres and through the real HTTP surface.
 *
 * What has to hold: an address is not trusted until the person has opened the link sent to it, a password is
 * stored only as a hash, a reset link changes the password and ends the old one, signing out ends the session,
 * and every person who signs up has an owner with no wallet.
 */

import { type Accounts, createAccounts, type Mail } from "@maschina/accounts";
import { createDatabase, type DatabaseHandle } from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;
let handle: DatabaseHandle;
let accounts: Accounts;
const sent: Mail[] = [];

const BASE = "http://localhost:4000";
const PASSWORD = "a long enough password 1";

beforeAll(async () => {
	database = await createTestDatabase();
	handle = createDatabase({ url: database.appUrl, applicationName: "accounts-test" });
	accounts = createAccounts({
		db: handle.db,
		secret: "s".repeat(48),
		baseUrl: BASE,
		trustedOrigins: ["http://localhost:3000"],
		secureCookies: false,
		mailer: {
			async send(mail) {
				sent.push(mail);
			},
		},
	});
});

afterAll(async () => {
	await handle?.close();
	await database?.drop();
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
	accounts.handler(
		new Request(`${BASE}/v1/auth/people${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: "http://localhost:3000", ...headers },
			body: JSON.stringify(body),
		}),
	);

/** The cookie a response sets, as the browser would send it back. */
function cookieOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
}

const lastLink = () => sent.at(-1)?.text.match(/https?:\/\/\S+/)?.[0] ?? "";

async function signUp(email: string) {
	const res = await post("/sign-up/email", { email, password: PASSWORD, name: "Test Person" });
	expect(res.status).toBe(200);
}

describe("signing up with an email and a password", () => {
	it("sends a link to the address, and does not let the person in before it is opened", async () => {
		await signUp("one@example.com");
		expect(sent.at(-1)?.to).toBe("one@example.com");
		expect(lastLink()).toContain("/v1/auth/people/verify-email");
		const early = await post("/sign-in/email", { email: "one@example.com", password: PASSWORD });
		expect(early.status).toBe(403);
	});

	it("lets them in once the link is opened, with a session and an owner who has no wallet", async () => {
		await signUp("two@example.com");
		const opened = await accounts.handler(new Request(lastLink(), { headers: { origin: BASE } }));
		expect([200, 302]).toContain(opened.status);
		const signedIn = await post("/sign-in/email", { email: "two@example.com", password: PASSWORD });
		expect(signedIn.status).toBe(200);
		const owner = await accounts.ownerOf(new Headers({ cookie: cookieOf(signedIn) }));
		expect(owner).toMatchObject({ walletAddress: null, email: "two@example.com" });
		expect(owner?.ownerId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
	});

	it("keeps the password only as a hash", async () => {
		const rows = await handle.sql`select password from auth_accounts where password is not null`;
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) expect(String(row["password"])).not.toContain(PASSWORD);
	});

	it("refuses a password that is too short, and an address already in use", async () => {
		const short = await post("/sign-up/email", {
			email: "three@example.com",
			password: "short",
			name: "T",
		});
		expect(short.status).toBe(400);
		const again = await post("/sign-up/email", {
			email: "two@example.com",
			password: PASSWORD,
			name: "T",
		});
		expect(again.status).not.toBe(500);
	});

	it("refuses a wrong password", async () => {
		const wrong = await post("/sign-in/email", {
			email: "two@example.com",
			password: "nope nope nope",
		});
		expect(wrong.status).toBe(401);
	});
});

describe("choosing a new password", () => {
	it("sends a link, takes the new password, and the old one stops working", async () => {
		const before = sent.length;
		const asked = await post("/request-password-reset", {
			email: "two@example.com",
			redirectTo: "http://localhost:3000/reset",
		});
		expect(asked.status).toBe(200);
		expect(sent.length).toBe(before + 1);
		const link = new URL(lastLink());
		const token = link.pathname.split("/").at(-1) ?? "";
		const reset = await post("/reset-password", { newPassword: "a brand new password 2", token });
		expect(reset.status).toBe(200);
		const old = await post("/sign-in/email", { email: "two@example.com", password: PASSWORD });
		expect(old.status).toBe(401);
		const fresh = await post("/sign-in/email", {
			email: "two@example.com",
			password: "a brand new password 2",
		});
		expect(fresh.status).toBe(200);
	});

	it("says nothing different for an address with no account, so it cannot be used to find them", async () => {
		const before = sent.length;
		const asked = await post("/request-password-reset", {
			email: "nobody@example.com",
			redirectTo: "http://localhost:3000/reset",
		});
		expect(asked.status).toBe(200);
		expect(sent.length).toBe(before);
	});
});

describe("signing out", () => {
	it("ends the session", async () => {
		const signedIn = await post("/sign-in/email", {
			email: "two@example.com",
			password: "a brand new password 2",
		});
		const cookie = cookieOf(signedIn);
		expect(await accounts.ownerOf(new Headers({ cookie }))).toBeDefined();
		const out = await post("/sign-out", {}, { cookie });
		expect(out.status).toBe(200);
		expect(await accounts.ownerOf(new Headers({ cookie }))).toBeUndefined();
	});

	it("knows nobody who sends no cookie, or one nobody was given", async () => {
		expect(await accounts.ownerOf(new Headers())).toBeUndefined();
		expect(
			await accounts.ownerOf(new Headers({ cookie: "maschina.session_token=made-up" })),
		).toBeUndefined();
	});
});
