import { describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
	init: vi.fn(),
	captureException: vi.fn(),
	flush: vi.fn(async () => true),
}));
vi.mock("@sentry/node", () => sentry);

import { initErrorReporting } from "./errors.ts";

describe("initErrorReporting", () => {
	it("does nothing without a DSN, and never loads the SDK", async () => {
		const reporter = await initErrorReporting({
			dsn: undefined,
			service: "x",
			environment: "test",
		});
		expect(reporter.enabled).toBe(false);
		reporter.capture(new Error("ignored"));
		await reporter.flush();
		expect(sentry.init).not.toHaveBeenCalled();
		expect(sentry.captureException).not.toHaveBeenCalled();
	});

	it("reports errors with the service tag and no personal data", async () => {
		const reporter = await initErrorReporting({
			dsn: "https://key@example.ingest.sentry.io/1",
			service: "gateway",
			environment: "production",
			release: "abc",
		});
		expect(reporter.enabled).toBe(true);
		expect(sentry.init).toHaveBeenCalledWith(
			expect.objectContaining({
				environment: "production",
				release: "abc",
				sendDefaultPii: false,
				initialScope: { tags: { service: "gateway" } },
			}),
		);

		const error = new Error("boom");
		reporter.capture(error, { runId: "r1" });
		reporter.capture(error);
		expect(sentry.captureException).toHaveBeenNthCalledWith(1, error, { extra: { runId: "r1" } });
		expect(sentry.captureException).toHaveBeenNthCalledWith(2, error, undefined);

		await reporter.flush(500);
		expect(sentry.flush).toHaveBeenCalledWith(500);
	});
});
