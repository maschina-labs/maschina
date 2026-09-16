import { describe, expect, it } from "vitest";
import { createQueryClient, isClientError } from "./query.ts";

describe("query client", () => {
	it("doesn't retry client errors, and retries others once", () => {
		const retry = createQueryClient().getDefaultOptions().queries?.retry as (
			failures: number,
			error: unknown,
		) => boolean;
		expect(retry(0, { status: 404 })).toBe(false);
		expect(retry(0, { status: 503 })).toBe(true);
		expect(retry(2, { status: 503 })).toBe(false);
	});

	it("recognises client errors", () => {
		expect(isClientError({ status: 400 })).toBe(true);
		expect(isClientError({ status: 500 })).toBe(false);
		expect(isClientError(new Error("x"))).toBe(false);
		expect(isClientError(null)).toBe(false);
	});
});
