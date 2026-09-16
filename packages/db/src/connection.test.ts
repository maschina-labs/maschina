import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { connectionOptions } from "./connection.ts";

const base = { applicationName: "gateway" };

describe("connectionOptions", () => {
	it.each([
		"postgres://u:p@localhost:5442/maschina",
		"postgres://u:p@127.0.0.1:5442/maschina",
		"postgres://u:p@postgres:5432/maschina",
	])("connects to %s without TLS", (url) => {
		expect(connectionOptions({ ...base, url }).ssl).toBe(false);
	});

	it("requires TLS for anything remote", () => {
		expect(
			connectionOptions({ ...base, url: "postgres://u:p@db.example.supabase.co:5432/postgres" })
				.ssl,
		).toBe("require");
	});

	it("names the connection after the service and disables prepared statements", () => {
		const options = connectionOptions({ ...base, url: "postgres://u:p@localhost/db" });
		expect(options.connection.application_name).toBe("gateway");
		expect(options.prepare).toBe(false);
		expect(options.max).toBe(10);
	});

	it("accepts a pool size and refuses a nonsense one", () => {
		const url = "postgres://u:p@localhost/db";
		expect(connectionOptions({ ...base, url, maxConnections: 3 }).max).toBe(3);
		expect(() => connectionOptions({ ...base, url, maxConnections: 0 })).toThrow(MaschinaError);
		expect(() => connectionOptions({ ...base, url, maxConnections: 1.5 })).toThrow(MaschinaError);
	});

	it("refuses a malformed URL without echoing it", () => {
		try {
			connectionOptions({ ...base, url: "not a url with password hunter2" });
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(MaschinaError);
			expect((error as Error).message).not.toContain("hunter2");
		}
	});
});
