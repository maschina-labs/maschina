import { describe, expect, it } from "vitest";
import { nextPhase, type RevealPhase } from "./reveal.ts";

describe("opening the detail layer", () => {
	it("grows on the first frame, then shows once it has landed", () => {
		expect(nextPhase("tile", "frame")).toBe("growing");
		expect(nextPhase("growing", "landed")).toBe("open");
	});

	it("shows even if the frames never came, because a background tab gets none", () => {
		// The timer runs in a tab nobody is looking at; the animation frames do not. The screen has
		// to appear either way, so landing from the tile skips the growing rather than waiting on it.
		expect(nextPhase("tile", "landed")).toBe("open");
	});

	it("is not closed again by a frame that arrives late", () => {
		// The whole bug. A tab opened in the background lands on the timer, then gets its first frame
		// when it is finally looked at. Going back to growing is a black screen nothing recovers from.
		expect(nextPhase("open", "frame")).toBe("open");
	});

	it("leaves on close, from wherever it was", () => {
		for (const at of ["tile", "growing", "open"] as RevealPhase[]) {
			expect(nextPhase(at, "close")).toBe("fading");
		}
	});

	it("stays leaving once it is leaving, whatever arrives after", () => {
		// A stale timer from the opening must not reopen a screen the person has already left.
		expect(nextPhase("fading", "landed")).toBe("fading");
		expect(nextPhase("fading", "frame")).toBe("fading");
		expect(nextPhase("fading", "close")).toBe("fading");
	});
});
