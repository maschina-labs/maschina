import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { loadClientEnv } from "./client.ts";
import { env } from "./index.ts";

describe("loadClientEnv", () => {
	it("loads public variables", () => {
		expect(
			loadClientEnv({ VITE_GATEWAY_URL: env.url() }, { VITE_GATEWAY_URL: "http://localhost:4000" }),
		).toEqual({ VITE_GATEWAY_URL: "http://localhost:4000" });
	});

	it("refuses anything without the VITE_ prefix", () => {
		expect(() => loadClientEnv({ DATABASE_URL: env.url() }, {})).toThrow(MaschinaError);
	});

	it.each(["VITE_API_SECRET", "VITE_PRIVATE_KEY", "VITE_DB_PASSWORD", "VITE_AUTH_TOKEN"])(
		"refuses %s because it looks like a secret",
		(key) => {
			expect(() => loadClientEnv({ [key]: env.url() }, {})).toThrow(/looks like a secret/);
		},
	);

	it("allows a token mint address, which is public", () => {
		expect(
			loadClientEnv(
				{ VITE_USDC_TOKEN_ADDRESS: env.url() },
				{ VITE_USDC_TOKEN_ADDRESS: "http://x.test" },
			),
		).toBeDefined();
	});
});
