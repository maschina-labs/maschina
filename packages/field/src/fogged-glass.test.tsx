import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoggedGlass, Grain } from "./fogged-glass.tsx";

describe("the fogged window", () => {
	it("darkens the field without ever being in the way of a click", () => {
		const { container } = render(<FoggedGlass />);
		const smoke = container.firstElementChild as HTMLElement;

		expect(smoke).toHaveAttribute("aria-hidden", "true");
		expect(smoke.className).toContain("pointer-events-none");
	});

	it("lays its grain over everything, and still never takes a click", () => {
		const { container } = render(<Grain />);
		const grain = container.firstElementChild as HTMLElement;

		expect(grain.className).toContain("z-50");
		expect(grain.className).toContain("pointer-events-none");
		expect(grain).toHaveAttribute("aria-hidden", "true");
	});

	it("blurs nothing, because a blur over the soft field only leaves rims", () => {
		const { container } = render(
			<>
				<FoggedGlass />
				<Grain />
			</>,
		);

		expect(container.innerHTML).not.toContain("backdrop-blur");
	});
});
