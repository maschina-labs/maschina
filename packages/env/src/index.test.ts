import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { env, loadEnv } from "./index.ts";

describe("loadEnv", () => {
	it("returns typed, defaulted values", () => {
		const config = loadEnv(
			{ NODE_ENV: env.nodeEnv(), PORT: env.port(4000), LOG_LEVEL: env.logLevel() },
			{ PORT: "4100" },
		);
		expect(config).toEqual({ NODE_ENV: "development", PORT: 4100, LOG_LEVEL: "info" });
	});

	it("lists every problem at once, by name", () => {
		try {
			loadEnv(
				{ DATABASE_URL: env.postgresUrl(), PORT: env.port(4000), TOKEN: env.secret() },
				{ PORT: "not-a-port", TOKEN: "short" },
			);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(MaschinaError);
			const message = (error as MaschinaError).message;
			expect(message).toContain("DATABASE_URL: is required");
			expect(message).toContain("PORT:");
			expect(message).toContain("TOKEN: must be at least 32 characters");
			expect((error as MaschinaError).details).toEqual({
				variables: expect.arrayContaining(["DATABASE_URL", "PORT", "TOKEN"]),
			});
		}
	});

	it("never includes a value in the error", () => {
		const value = "hunter2-this-is-a-secret-value-xxxxxxxxxx";
		try {
			loadEnv({ PORT: env.port(1) }, { PORT: value });
			expect.unreachable();
		} catch (error) {
			expect((error as Error).message).not.toContain(value);
		}
	});

	it("treats empty strings as not set", () => {
		const config = loadEnv({ SENTRY_DSN: env.optional(env.url()) }, { SENTRY_DSN: "" });
		expect(config.SENTRY_DSN).toBeUndefined();
	});

	it("refuses the placeholder secret from .env.example", () => {
		expect(() =>
			loadEnv({ TOKEN: env.secret() }, { TOKEN: "replace-with-a-real-value-xxxxxxxxxxxxxxx" }),
		).toThrow(/placeholder/);
	});

	it("accepts a real secret", () => {
		const token = "a".repeat(32);
		expect(loadEnv({ TOKEN: env.secret() }, { TOKEN: token }).TOKEN).toBe(token);
	});

	it("only accepts postgres URLs for databases", () => {
		expect(() => loadEnv({ DB: env.postgresUrl() }, { DB: "mysql://x" })).toThrow(/postgres/);
		expect(loadEnv({ DB: env.postgresUrl() }, { DB: "postgres://u:p@localhost:5442/db" }).DB).toBe(
			"postgres://u:p@localhost:5442/db",
		);
	});

	it("splits lists and drops blanks", () => {
		expect(
			loadEnv({ ORIGINS: env.list() }, { ORIGINS: "http://a.test, http://b.test,," }).ORIGINS,
		).toEqual(["http://a.test", "http://b.test"]);
	});

	it("validates URLs and ports", () => {
		expect(() => loadEnv({ U: env.url() }, { U: "not a url" })).toThrow(MaschinaError);
		expect(() => loadEnv({ P: env.port(1) }, { P: "70000" })).toThrow(MaschinaError);
		expect(() => loadEnv({ P: env.port(1) }, { P: "1.5" })).toThrow(MaschinaError);
	});

	it("reads process.env by default", () => {
		process.env["MASCHINA_ENV_TEST"] = "yes";
		expect(loadEnv({ MASCHINA_ENV_TEST: z.string() }).MASCHINA_ENV_TEST).toBe("yes");
		delete process.env["MASCHINA_ENV_TEST"];
	});

	it("rejects an unknown log level", () => {
		expect(() => loadEnv({ L: env.logLevel() }, { L: "loud" })).toThrow(MaschinaError);
	});
});
