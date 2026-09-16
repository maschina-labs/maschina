import { describe, expect, it } from "vitest";
import { ERROR_CODES, isMaschinaError, MaschinaError } from "./errors.ts";

describe("MaschinaError", () => {
	it("carries a code, a status and optional details", () => {
		const error = new MaschinaError("not_found", "machine not found", { details: { id: "x" } });
		expect(error.code).toBe("not_found");
		expect(error.status).toBe(404);
		expect(error.details).toEqual({ id: "x" });
		expect(error.message).toBe("machine not found");
		expect(error.name).toBe("MaschinaError");
	});

	it("keeps the underlying cause", () => {
		const cause = new Error("connection refused");
		const error = new MaschinaError("unavailable", "database unavailable", { cause });
		expect(error.cause).toBe(cause);
	});

	it("maps every code to an HTTP status", () => {
		for (const [code, status] of Object.entries(ERROR_CODES)) {
			expect(new MaschinaError(code as keyof typeof ERROR_CODES, "x").status).toBe(status);
		}
	});

	it("is recognised only when it really is one", () => {
		expect(isMaschinaError(new MaschinaError("internal", "x"))).toBe(true);
		expect(isMaschinaError(new Error("x"))).toBe(false);
		expect(isMaschinaError({ code: "internal" })).toBe(false);
	});
});
