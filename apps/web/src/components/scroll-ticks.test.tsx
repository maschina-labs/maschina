import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { placeOf, ScrollArea } from "./scroll-ticks.tsx";

describe("the scroll ruler", () => {
	it("says where the scroll sits, from the top to the bottom", () => {
		expect(placeOf(0, 2000, 800)).toBe(0);
		expect(placeOf(1200, 2000, 800)).toBe(1);
		expect(placeOf(600, 2000, 800)).toBe(0.5);
	});

	it("says nothing when there is nothing to scroll", () => {
		expect(placeOf(0, 800, 800)).toBeUndefined();
	});

	it("shows no ruler over an area that does not scroll", () => {
		const { container } = render(
			<ScrollArea>
				<p>short</p>
			</ScrollArea>,
		);

		expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
	});
});
