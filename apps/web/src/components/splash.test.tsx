import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FADE_MS, HOLD_MS, IN_MS, Splash, useSplash } from "./splash.tsx";

beforeEach(() => {
	sessionStorage.clear();
	vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("the opening moment", () => {
	it("shows the ring, then hands over to the app, and remembers it for the visit", () => {
		const { result } = renderHook(() => useSplash());
		expect(result.current).toBe("mark");
		// A second to arrive and a second held: still the ring.
		act(() => vi.advanceTimersByTime(IN_MS + HOLD_MS - 1));
		expect(result.current).toBe("mark");
		act(() => vi.advanceTimersByTime(1));
		expect(result.current).toBe("leaving");
		act(() => vi.advanceTimersByTime(FADE_MS));
		expect(result.current).toBe("done");
		expect(sessionStorage.getItem("maschina.splashed")).toBe("1");
	});

	it("does not play again on the same visit", () => {
		sessionStorage.setItem("maschina.splashed", "1");
		const { result } = renderHook(() => useSplash());
		expect(result.current).toBe("done");
	});

	it("draws the ring until it is done, and nothing after", () => {
		const { container, rerender } = render(<Splash phase="mark" />);
		expect(container.querySelector("img")).not.toBeNull();
		rerender(<Splash phase="done" />);
		expect(container.querySelector("img")).toBeNull();
		expect(screen.queryByRole("img")).toBeNull();
	});
});
