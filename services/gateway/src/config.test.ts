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

	it("needs the origins set", () => {
		expect(() => loadConfig({})).toThrow(/GATEWAY_CORS_ORIGINS/);
	});

	it("needs the record and the provisioner", () => {
		expect(() => loadConfig({ GATEWAY_CORS_ORIGINS: "http://localhost:3000" })).toThrow(
			/DATABASE_URL[\s\S]*PROVISIONER_URL/,
		);
	});

	it("takes a development owner, which production refuses", () => {
		const wallet = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
		expect(loadConfig({ ...complete, GATEWAY_DEV_OWNER_WALLET: wallet })).toMatchObject({
			GATEWAY_DEV_OWNER_WALLET: wallet,
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
