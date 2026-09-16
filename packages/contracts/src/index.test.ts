import { describe, expect, it } from "vitest";
import { ErrorBody, HealthResponse } from "./index.ts";

describe("HealthResponse", () => {
	it("accepts a healthy response", () => {
		const body = {
			status: "ok",
			service: "gateway",
			version: "0.0.0",
			time: "2026-09-16T12:00:00.000Z",
		};
		expect(HealthResponse.parse(body)).toEqual(body);
	});

	it("refuses an unknown status or a malformed time", () => {
		expect(() =>
			HealthResponse.parse({ status: "fine", service: "x", version: "1", time: "now" }),
		).toThrow();
	});
});

describe("ErrorBody", () => {
	it("requires a code, a message and a request id", () => {
		expect(() => ErrorBody.parse({ error: { code: "x", message: "y" } })).toThrow();
		expect(
			ErrorBody.parse({ error: { code: "not_found", message: "nope", requestId: "r" } }),
		).toBeDefined();
	});
});
