import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePresence } from "./presence.ts";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const run = (ms: number) =>
	act(() => {
		vi.advanceTimersByTime(ms);
	});

describe("staying on screen while something closes", () => {
	it("starts absent when it starts closed", () => {
		const { result } = renderHook(() => usePresence(false, 200));
		expect(result.current).toEqual({ mounted: false, visible: false, closing: false });
	});

	it("is already there, and visible, when it starts open", () => {
		const { result } = renderHook(() => usePresence(true, 200));
		expect(result.current).toEqual({ mounted: true, visible: true, closing: false });
	});

	it("is there at once on opening, and turns visible a moment later so it can slide in", () => {
		const { result, rerender } = renderHook(({ show }) => usePresence(show, 200), {
			initialProps: { show: false },
		});
		rerender({ show: true });
		expect(result.current).toEqual({ mounted: true, visible: false, closing: false });
		run(30);
		expect(result.current).toEqual({ mounted: true, visible: true, closing: false });
	});

	it("starts to leave the instant it closes, and is gone only after the exit has played", () => {
		const { result, rerender } = renderHook(({ show }) => usePresence(show, 200), {
			initialProps: { show: true },
		});
		run(30);
		rerender({ show: false });
		expect(result.current).toEqual({ mounted: true, visible: false, closing: true });
		run(199);
		expect(result.current.mounted).toBe(true);
		run(2);
		expect(result.current).toEqual({ mounted: false, visible: false, closing: false });
	});

	it("stays if it is opened again while it is still leaving", () => {
		const { result, rerender } = renderHook(({ show }) => usePresence(show, 200), {
			initialProps: { show: true },
		});
		rerender({ show: false });
		run(100);
		rerender({ show: true });
		run(300);
		expect(result.current).toEqual({ mounted: true, visible: true, closing: false });
	});

	it("does not wait at all when there is no exit to play, as with reduced motion", () => {
		const { result, rerender } = renderHook(({ show }) => usePresence(show, 0), {
			initialProps: { show: true },
		});
		rerender({ show: false });
		expect(result.current).toEqual({ mounted: false, visible: false, closing: false });
	});
});
