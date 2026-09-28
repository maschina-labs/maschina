import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BandRuler, tickOf } from "./band-ruler.tsx";

describe("the band ruler", () => {
	it("puts sell near the top, buy near the bottom, and the middle of the band in the middle", () => {
		const sell = tickOf(121.2, 118.8, 121.2);
		const buy = tickOf(118.8, 118.8, 121.2);
		expect(sell).toBeLessThan(buy);
		expect(tickOf(120, 118.8, 121.2)).toBe(20);
	});

	it("holds a price far outside the band to the ends of the ruler", () => {
		expect(tickOf(200, 118.8, 121.2)).toBe(0);
		expect(tickOf(50, 118.8, 121.2)).toBe(40);
	});

	it("marks both lines and lights the live price", () => {
		render(<BandRuler buy={118.8} sell={121.2} price={119.53} />);

		expect(screen.getByText("SELL 121.20")).toBeInTheDocument();
		expect(screen.getByText("BUY 118.80")).toBeInTheDocument();
		expect(screen.getByText("119.53")).toBeInTheDocument();
	});
});
