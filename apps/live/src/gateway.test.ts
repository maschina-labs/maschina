import { describe, expect, it } from "vitest";
import { GATEWAY } from "./gateway.ts";

describe("where the record is read from", () => {
	it("is an absolute address, never this page's own origin", () => {
		// The Worker in front of this app answers any unknown path with the page itself, so a relative
		// address returns HTML with a 200 and the record silently shows nothing.
		expect(GATEWAY).toMatch(/^https?:\/\//);
	});

	it("points at the API rather than at the record's own host", () => {
		expect(new URL(GATEWAY).host).not.toBe("live.maschina.dev");
	});
});
