import { describe, expect, it } from "vitest";
import { sectionIndex } from "./deck.tsx";

describe("which section an address is", () => {
	it("is the section at its own address", () => {
		expect(sectionIndex("/")).toBe(0);
		expect(sectionIndex("/machines")).toBe(3);
		expect(sectionIndex("/network")).toBe(7);
		expect(sectionIndex("/network/")).toBe(7);
	});

	it("is no section for a screen under one, which opens over it instead", () => {
		expect(sectionIndex("/network/join")).toBe(-1);
		expect(sectionIndex("/network/abc")).toBe(-1);
		expect(sectionIndex("/marketplace/abc")).toBe(-1);
		expect(sectionIndex("/machines/abc")).toBe(-1);
		expect(sectionIndex("/settings")).toBe(-1);
	});
});
