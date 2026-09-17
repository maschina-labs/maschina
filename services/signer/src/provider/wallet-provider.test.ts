import { MaschinaError } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { providerError, toMaschinaError } from "./wallet-provider.ts";

describe("provider errors", () => {
	it("marks only outages as worth retrying", () => {
		expect(providerError("unavailable", "down").retryable).toBe(true);
		for (const kind of ["refused", "not_found", "invalid", "unexpected"] as const) {
			expect(providerError(kind, "x").retryable, kind).toBe(false);
		}
	});

	it("maps each kind to one Maschina error code, keeping the kind and details", () => {
		const cases = {
			refused: "forbidden",
			not_found: "not_found",
			invalid: "invalid_input",
			unavailable: "unavailable",
			unexpected: "internal",
		} as const;
		for (const [kind, code] of Object.entries(cases)) {
			const error = toMaschinaError(
				providerError(kind as keyof typeof cases, "why", { rule: "r" }),
			);
			expect(error).toBeInstanceOf(MaschinaError);
			expect(error.code, kind).toBe(code);
			expect(error.details).toEqual({ providerErrorKind: kind, rule: "r" });
		}
	});

	it("keeps the provider's original error as the cause, and leaves it out when there is none", () => {
		const original = new Error("socket hang up");
		expect(providerError("unavailable", "down", {}, original).cause).toBe(original);
		expect(toMaschinaError(providerError("unavailable", "down", {}, original)).cause).toBe(
			original,
		);
		expect("cause" in providerError("unavailable", "down")).toBe(false);
	});
});
