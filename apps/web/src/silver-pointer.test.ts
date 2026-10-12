import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { followSilver } from "./silver-pointer.ts";

let stop: () => void;
let button: HTMLElement;
const move = (target: Element, init: Record<string, unknown>) =>
	target.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, ...init }));

beforeEach(() => {
	vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
	document.body.innerHTML = '<a class="silver-button" href="/">Go</a><p>text</p>';
	button = document.querySelector(".silver-button") as HTMLElement;
	button.getBoundingClientRect = () => ({ left: 100, top: 20, width: 200, height: 40 }) as DOMRect;
	stop = followSilver();
});
afterEach(() => {
	stop();
	vi.unstubAllGlobals();
});

describe("the pearl shimmer on a silver button follows the pointer", () => {
	it("sets where the pointer is across the button, as a percentage of its width", () => {
		move(button, { clientX: 100 });
		expect(button.style.getPropertyValue("--shine-x")).toBe("0%");
		move(button, { clientX: 200 });
		expect(button.style.getPropertyValue("--shine-x")).toBe("50%");
		move(button, { clientX: 300 });
		expect(button.style.getPropertyValue("--shine-x")).toBe("100%");
	});

	it("keeps it between the two ends of the button, even when the pointer is just outside its edge", () => {
		move(button, { clientX: 40 });
		expect(button.style.getPropertyValue("--shine-x")).toBe("0%");
		move(button, { clientX: 999 });
		expect(button.style.getPropertyValue("--shine-x")).toBe("100%");
	});

	it("works from anything inside the button, such as its label or its chip", () => {
		button.innerHTML = '<span id="label">Go</span>';
		const inner = document.getElementById("label") as HTMLElement;
		move(inner, { clientX: 250 });
		expect(button.style.getPropertyValue("--shine-x")).toBe("75%");
	});

	it("also works for the phone-only Sign In box", () => {
		document.body.innerHTML = '<a class="silver-button-mobile" href="/">In</a>';
		const box = document.querySelector(".silver-button-mobile") as HTMLElement;
		box.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 40 }) as DOMRect;
		move(box, { clientX: 25 });
		expect(box.style.getPropertyValue("--shine-x")).toBe("25%");
	});

	it("lets go when the pointer leaves, so the next visit starts from the far end again", () => {
		move(button, { clientX: 150 });
		expect(button.style.getPropertyValue("--shine-x")).toBe("25%");
		button.dispatchEvent(
			new MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body }),
		);
		expect(button.style.getPropertyValue("--shine-x")).toBe("");
	});

	it("ignores a finger, anything that is not a silver button, and anyone who asked for less motion", () => {
		const touch = new Event("pointermove", { bubbles: true }) as Event & {
			pointerType: string;
			clientX: number;
		};
		touch.pointerType = "touch";
		touch.clientX = 150;
		button.dispatchEvent(touch);
		expect(button.style.getPropertyValue("--shine-x")).toBe("");
		move(document.querySelector("p") as Element, { clientX: 150 });
		expect(document.body.innerHTML).not.toContain("--shine-x");
		stop();
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("reduce"),
			media: query,
		}));
		stop = followSilver();
		move(button, { clientX: 150 });
		expect(button.style.getPropertyValue("--shine-x")).toBe("");
	});

	it("can be switched off, and then no longer follows", () => {
		stop();
		move(button, { clientX: 150 });
		expect(button.style.getPropertyValue("--shine-x")).toBe("");
		stop = followSilver();
	});
});
