import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
	cleanup();
});

// The test browser has no media queries. The background asks whether motion is reduced, so it is told
// no, the same answer most real browsers give.
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}),
});

// Nor does it measure layout, so nothing ever resizes. Scrolling areas watch for size changes.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as unknown as typeof ResizeObserver;

// Nor does it watch what is on screen. The globe asks, to turn only while it can be seen; here it is
// simply never told, so it stays still.
class IntersectionObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
	takeRecords() {
		return [];
	}
}
Object.defineProperty(window, "IntersectionObserver", {
	writable: true,
	value: IntersectionObserverStub,
});
