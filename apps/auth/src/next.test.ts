import { describe, expect, it } from "vitest";
import { safeNext } from "./next.ts";

const APP = "https://app.maschina.dev";

describe("where a person goes after signing in", () => {
	it("is the app when nothing was asked", () => {
		expect(safeNext(null, APP)).toBe(APP);
		expect(safeNext("", APP)).toBe(APP);
	});

	it("is a Maschina address when one was asked", () => {
		expect(safeNext("https://app.maschina.dev/portfolio?x=1", APP)).toBe(
			"https://app.maschina.dev/portfolio?x=1",
		);
		expect(safeNext("https://maschina.dev/es", APP)).toBe("https://maschina.dev/es");
	});

	it("is never another site, however it is dressed, because that would send a signed in person anywhere", () => {
		for (const bad of [
			"https://evil.example",
			"https://maschina.dev.evil.example",
			"https://evilmaschina.dev",
			"//evil.example",
			"javascript:alert(1)",
			"http://app.maschina.dev",
			"https://app.maschina.dev@evil.example",
			"not a url",
		])
			expect(safeNext(bad, APP), bad).toBe(APP);
	});

	it("allows the local app when the app itself is local", () => {
		expect(safeNext("http://localhost:3002/x", "http://localhost:3002")).toBe(
			"http://localhost:3002/x",
		);
	});
});
