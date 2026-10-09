import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showScrollbarsWhileScrolling } from "./scrollbars.ts";

describe("scrollbars that show only while scrolling", () => {
	let stop: () => void;
	beforeEach(() => {
		vi.useFakeTimers();
		stop = showScrollbarsWhileScrolling(document);
	});
	afterEach(() => {
		stop();
		vi.useRealTimers();
		document.body.innerHTML = "";
		document.body.removeAttribute("data-scrolling");
	});

	it("marks whatever is scrolling, and clears the mark a moment after it stops", () => {
		const list = document.createElement("div");
		document.body.append(list);
		list.dispatchEvent(new Event("scroll"));
		expect(list).toHaveAttribute("data-scrolling");
		vi.advanceTimersByTime(300);
		expect(list).toHaveAttribute("data-scrolling");
		vi.advanceTimersByTime(1000);
		expect(list).not.toHaveAttribute("data-scrolling");
	});

	it("keeps the mark on while it keeps scrolling", () => {
		const list = document.createElement("div");
		document.body.append(list);
		list.dispatchEvent(new Event("scroll"));
		vi.advanceTimersByTime(700);
		list.dispatchEvent(new Event("scroll"));
		vi.advanceTimersByTime(700);
		expect(list).toHaveAttribute("data-scrolling");
		vi.advanceTimersByTime(600);
		expect(list).not.toHaveAttribute("data-scrolling");
	});

	it("marks the body when the page scrolls: the page's scrollbar takes its style from the body", () => {
		document.dispatchEvent(new Event("scroll"));
		expect(document.body).toHaveAttribute("data-scrolling");
		expect(document.documentElement).not.toHaveAttribute("data-scrolling");
		vi.advanceTimersByTime(1500);
		expect(document.body).not.toHaveAttribute("data-scrolling");
	});

	it("stops listening when asked", () => {
		stop();
		document.dispatchEvent(new Event("scroll"));
		expect(document.body).not.toHaveAttribute("data-scrolling");
	});
});
