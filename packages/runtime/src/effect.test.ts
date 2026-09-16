import { describe, expect, it } from "vitest";
import { recoveryFor } from "./effect.ts";

describe("recoveryFor", () => {
	it("maps each effect class to one recovery", () => {
		expect(recoveryFor("idempotent")).toBe("repeat");
		expect(recoveryFor("reconcilable")).toBe("ask_the_world");
		expect(recoveryFor("unsafe")).toBe("ask_a_person");
	});
});
