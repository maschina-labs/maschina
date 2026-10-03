import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { deltaOf, Stat } from "./stat.tsx";

describe("a number tile", () => {
	it("with history, shows the number, its unit, its change and a sparkline", () => {
		const { container } = render(
			<Stat
				label="Realized"
				value="23.74"
				unit="USDC"
				series={[1, 3, 2, 8]}
				delta={deltaOf([1, 8], (v) => `$${v.toFixed(2)}`, "7D")}
			/>,
		);
		expect(container.querySelector("[data-layout]")?.getAttribute("data-layout")).toBe("spark");
		expect(screen.getByText("23.74")).toBeInTheDocument();
		expect(screen.getByText("USDC")).toBeInTheDocument();
		expect(screen.getByText("+$7.00")).toBeInTheDocument();
		expect(screen.getByText("· 7D")).toBeInTheDocument();
		expect(container.querySelector('svg path[fill="none"]')).not.toBeNull();
	});

	it("without history, keeps the number on top and no sparkline", () => {
		const { container } = render(<Stat label="Holding" value="0.34" unit="SOL" />);
		expect(container.querySelector("[data-layout]")?.getAttribute("data-layout")).toBe("top");
		expect(container.querySelector("svg path")).toBeNull();
	});

	it("can put its label on top and its number at the foot", () => {
		const { container } = render(<Stat layout="label" label="In play" value="40.00" unit="USDC" />);
		const tile = container.querySelector("[data-layout='label']");
		expect(tile?.firstElementChild?.textContent).toBe("In play");
	});

	it("says a fall as a fall", () => {
		expect(deltaOf([5, 2], (v) => v.toFixed(1))).toEqual({ text: "-3.0", up: false });
		expect(deltaOf([5], (v) => v.toFixed(1))).toBeUndefined();
	});
});
