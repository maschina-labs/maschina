import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Scramble, scrambled } from "./scramble.tsx";

describe("scrambled text", () => {
	it("settles the first letters and leaves the rest as noise, keeping spaces", () => {
		expect(scrambled("THE NETWORK", 3, () => "#")).toBe("THE #######");
		expect(scrambled("THE NETWORK", 99, () => "#")).toBe("THE NETWORK");
	});

	it("always gives screen readers the real text", () => {
		render(<Scramble text="THE NETWORK" />);

		expect(screen.getByText("THE NETWORK")).toHaveClass("sr-only");
	});
});
