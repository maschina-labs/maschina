import { describe, expect, it } from "vitest";
import { MaschinaError } from "./errors.ts";
import { type MachineId, newId, parseId } from "./id.ts";

describe("ids", () => {
	it("creates valid, unique ids", () => {
		const ids = new Set(Array.from({ length: 1000 }, () => newId<"machine">()));
		expect(ids.size).toBe(1000);
		for (const id of ids) expect(parseId(id, "machine")).toBe(id);
	});

	it("creates ids that sort in creation order", () => {
		const ids = Array.from({ length: 200 }, () => newId<"run">());
		expect([...ids].sort()).toEqual(ids);
	});

	it.each([
		"",
		"not-an-id",
		"00000000-0000-4000-8000-000000000000",
		"0190d3a1-7c2e-7b3a-9f10-0000000000zz",
		"0190D3A1-7C2E-7B3A-9F10-000000000000",
	])("refuses %j", (value) => {
		expect(() => parseId(value, "machine")).toThrow(MaschinaError);
	});

	it("keeps kinds apart at compile time", () => {
		const machine: MachineId = newId<"machine">();
		// @ts-expect-error a run id is not a machine id
		const wrong: MachineId = newId<"run">();
		expect(typeof machine).toBe("string");
		expect(typeof wrong).toBe("string");
	});
});
