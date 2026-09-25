import { MaschinaError } from "@maschina/core";
import { testWallet } from "@maschina/solana/testing";
import { describe, expect, it } from "vitest";
import { signInMessage, verifySignIn } from "./siws.ts";

const DOMAIN = "maschina.dev";
const NONCE = "8f2c1a9b4d7e0f63";
const ISSUED = new Date("2026-09-25T12:00:00.000Z");
const EXPIRES = new Date("2026-09-25T12:05:00.000Z");

const wallet = testWallet;

const asked = (address: string) =>
	signInMessage({
		domain: DOMAIN,
		uri: `https://${DOMAIN}`,
		address,
		nonce: NONCE,
		issuedAt: ISSUED,
		expiresAt: EXPIRES,
	});

const at = (moment: string) => new Date(moment);

describe("the message a wallet is asked to sign", () => {
	it("says who is asking, which account, and that nothing is being approved", async () => {
		const { address } = await wallet();
		const message = asked(address);

		expect(message).toContain(`${DOMAIN} wants you to sign in with your Solana account:`);
		expect(message).toContain(address);
		expect(message).toContain("does not approve any transaction");
		expect(message).toContain(`Nonce: ${NONCE}`);
		expect(message).toContain(`Expiration Time: ${EXPIRES.toISOString()}`);
	});

	it("is the same message every time, so what was signed can be rebuilt exactly", async () => {
		const { address } = await wallet();
		expect(asked(address)).toBe(asked(address));
	});
});

describe("verifying a signed message", () => {
	const check = (message: string, signature: string, now: Date, domain = DOMAIN) =>
		verifySignIn({ message, signature, domain, now, nonce: NONCE });

	it("accepts a message this wallet really signed", async () => {
		const { address, sign } = await wallet();
		const message = asked(address);

		const result = await check(message, await sign(message), at("2026-09-25T12:01:00.000Z"));

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.address).toBe(address);
			expect(result.value.nonce).toBe(NONCE);
			expect(result.value.expiresAt).toEqual(EXPIRES);
		}
	});

	it("refuses a signature from a different wallet", async () => {
		const { address } = await wallet();
		const other = await wallet();
		const message = asked(address);

		const result = await check(message, await other.sign(message), at("2026-09-25T12:01:00.000Z"));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe("unauthenticated");
	});

	it("refuses a message that was changed after it was signed", async () => {
		const { address, sign } = await wallet();
		const message = asked(address);
		const signature = await sign(message);

		const tampered = message.replace(NONCE, "0000000000000000");
		const result = await verifySignIn({
			message: tampered,
			signature,
			domain: DOMAIN,
			now: at("2026-09-25T12:01:00.000Z"),
			nonce: "0000000000000000",
		});

		expect(result.ok).toBe(false);
	});

	it("refuses a message addressed to somebody else's domain", async () => {
		const { address, sign } = await wallet();
		const message = signInMessage({
			domain: "evil.example",
			uri: "https://evil.example",
			address,
			nonce: NONCE,
			issuedAt: ISSUED,
			expiresAt: EXPIRES,
		});

		const result = await check(message, await sign(message), at("2026-09-25T12:01:00.000Z"));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.details).toMatchObject({ domain: "evil.example" });
	});

	it("refuses a message whose nonce is not the one that was handed out", async () => {
		const { address, sign } = await wallet();
		const message = asked(address);

		const result = await verifySignIn({
			message,
			signature: await sign(message),
			domain: DOMAIN,
			now: at("2026-09-25T12:01:00.000Z"),
			nonce: "a different nonce entirely",
		});

		expect(result.ok).toBe(false);
	});

	it("refuses a message that has expired", async () => {
		const { address, sign } = await wallet();
		const message = asked(address);

		const result = await check(message, await sign(message), at("2026-09-25T12:06:00.000Z"));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.message).toContain("expired");
	});

	it("refuses a message dated in the future, beyond a little clock drift", async () => {
		const { address, sign } = await wallet();
		const message = asked(address);

		const result = await check(message, await sign(message), at("2026-09-25T11:58:00.000Z"));

		expect(result.ok).toBe(false);
	});

	it("allows the small clock difference between a browser and a server", async () => {
		const { address, sign } = await wallet();
		const message = asked(address);

		const result = await check(message, await sign(message), at("2026-09-25T11:59:50.000Z"));

		expect(result.ok).toBe(true);
	});

	it("refuses something that is not a message at all", async () => {
		const { sign } = await wallet();
		const nonsense = "sign this and I will give you a boat";

		const result = await check(nonsense, await sign(nonsense), at("2026-09-25T12:01:00.000Z"));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBeInstanceOf(MaschinaError);
	});

	it("refuses a signature that is not base58, rather than throwing", async () => {
		const { address } = await wallet();
		const message = asked(address);

		const result = await check(message, "not a signature", at("2026-09-25T12:01:00.000Z"));

		expect(result.ok).toBe(false);
	});
});
