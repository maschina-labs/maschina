import { describe, expect, it } from "vitest";
import { clientKey } from "./app.ts";
import { loadConfig } from "./config.ts";

describe("gateway config", () => {
	it("reads the allowed origins as a list", () => {
		expect(
			loadConfig({ GATEWAY_CORS_ORIGINS: "http://localhost:3000, https://maschina.dev" }),
		).toMatchObject({
			GATEWAY_PORT: 4000,
			GATEWAY_CORS_ORIGINS: ["http://localhost:3000", "https://maschina.dev"],
		});
	});

	it("needs the origins set", () => {
		expect(() => loadConfig({})).toThrow(/GATEWAY_CORS_ORIGINS/);
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
