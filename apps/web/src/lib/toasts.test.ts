import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast, useToasts } from "./toasts.ts";

describe("toasts", () => {
	it("show what happened, and fade on their own", () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useToasts());

		act(() => toast("paused · range finder"));
		expect(result.current.map((each) => each.text)).toEqual(["PAUSED · RANGE FINDER"]);

		act(() => vi.advanceTimersByTime(4_000));
		expect(result.current).toEqual([]);
		vi.useRealTimers();
	});
});
