import { describe, expect, it } from "vitest";
import { clientKey } from "./app.ts";
import { loadConfig } from "./config.ts";

const complete = {
	GATEWAY_CORS_ORIGINS: "http://localhost:3000, https://maschina.dev",
	DATABASE_URL: "postgres://maschina_app:pw@localhost:5442/maschina",
	PROVISIONER_URL: "http://provisioner:4400",
	PROVISIONER_GATEWAY_TOKEN: "g".repeat(40),
};

describe("gateway config", () => {
	it("reads the allowed origins as a list", () => {
		expect(loadConfig(complete)).toMatchObject({
			GATEWAY_PORT: 4000,
			GATEWAY_CORS_ORIGINS: ["http://localhost:3000", "https://maschina.dev"],
		});
	});

	it("takes a sealing key only when it is 32 bytes", () => {
		const key = Buffer.alloc(32, 7).toString("base64");
		expect(loadConfig({ ...complete, GATEWAY_SECRETS_KEY: key }).GATEWAY_SECRETS_KEY).toBe(key);
		expect(() =>
			loadConfig({ ...complete, GATEWAY_SECRETS_KEY: Buffer.alloc(16).toString("base64") }),
		).toThrow(/GATEWAY_SECRETS_KEY/);
		expect(loadConfig(complete).GATEWAY_SECRETS_KEY).toBeUndefined();
	});

	it("takes the owner whose machines are shown publicly only as a real id, and shows none otherwise", () => {
		const id = "01a0e674-dbbf-75e0-a420-970000000000";
		expect(loadConfig({ ...complete, PUBLIC_RECORD_OWNER_ID: id }).PUBLIC_RECORD_OWNER_ID).toBe(id);
		expect(() => loadConfig({ ...complete, PUBLIC_RECORD_OWNER_ID: "range-finder" })).toThrow(
			/PUBLIC_RECORD_OWNER_ID/,
		);
		expect(loadConfig(complete).PUBLIC_RECORD_OWNER_ID).toBeUndefined();
	});

	it("takes the sign in secret only when it is long enough, and leaves signing in off without it", () => {
		const secret = "s".repeat(40);
		expect(loadConfig({ ...complete, GATEWAY_AUTH_SECRET: secret }).GATEWAY_AUTH_SECRET).toBe(
			secret,
		);
		expect(() => loadConfig({ ...complete, GATEWAY_AUTH_SECRET: "short" })).toThrow(
			/GATEWAY_AUTH_SECRET/,
		);
		expect(loadConfig(complete).GATEWAY_AUTH_SECRET).toBeUndefined();
	});

	it("says where the gateway is reached from outside, with a local default", () => {
		expect(loadConfig(complete).GATEWAY_PUBLIC_URL).toBe("http://localhost:4000");
		expect(
			loadConfig({ ...complete, GATEWAY_PUBLIC_URL: "https://api.maschina.dev" })
				.GATEWAY_PUBLIC_URL,
		).toBe("https://api.maschina.dev");
	});

	it("takes Google and GitHub as a client id and a secret together or not at all", () => {
		const both = {
			GOOGLE_CLIENT_ID: "gid",
			GOOGLE_CLIENT_SECRET: "g".repeat(12),
			GITHUB_CLIENT_ID: "hid",
			GITHUB_CLIENT_SECRET: "h".repeat(12),
		};
		expect(loadConfig({ ...complete, ...both })).toMatchObject(both);
		expect(loadConfig(complete).GOOGLE_CLIENT_ID).toBeUndefined();
	});

	it("takes a Jupiter key when one is set", () => {
		expect(loadConfig({ ...complete, JUPITER_API_KEY: "jup-key-123" }).JUPITER_API_KEY).toBe(
			"jup-key-123",
		);
		expect(loadConfig(complete).JUPITER_API_KEY).toBeUndefined();
	});

	it("needs the origins set", () => {
		expect(() => loadConfig({})).toThrow(/GATEWAY_CORS_ORIGINS/);
	});

	it("needs the record and the provisioner", () => {
		expect(() => loadConfig({ GATEWAY_CORS_ORIGINS: "http://localhost:3000" })).toThrow(
			/DATABASE_URL[\s\S]*PROVISIONER_URL/,
		);
	});

	it("signs in against localhost until it is told otherwise", () => {
		expect(loadConfig(complete)).toMatchObject({
			GATEWAY_DOMAIN: "localhost:3002",
			GATEWAY_APP_URL: "http://localhost:3002",
		});
	});

	it("takes the domain a signature is good for, and the domain the cookie is shared across", () => {
		expect(
			loadConfig({
				...complete,
				GATEWAY_DOMAIN: "maschina.dev",
				GATEWAY_APP_URL: "https://maschina.dev",
				GATEWAY_COOKIE_DOMAIN: ".maschina.dev",
			}),
		).toMatchObject({
			GATEWAY_DOMAIN: "maschina.dev",
			GATEWAY_COOKIE_DOMAIN: ".maschina.dev",
		});
	});
});

describe("clientKey", () => {
	const context = (headers: Record<string, string>) =>
		({ req: { header: (name: string) => headers[name] } }) as unknown as Parameters<
			typeof clientKey
		>[0];

	it("prefers the platform's real IP, then the first forwarded address", () => {
		expect(clientKey(context({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe(
			"1.1.1.1",
		);
		expect(clientKey(context({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
		expect(clientKey(context({}))).toBe("unknown");
	});
});
