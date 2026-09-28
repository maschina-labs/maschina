import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BandDial, dialPlace, inBand } from "./band-dial.tsx";

describe("the band dial", () => {
	it("places the buy line before the sell line, with room either side", () => {
		const buy = dialPlace(118.8, 118.8, 121.2);
		const sell = dialPlace(121.2, 118.8, 121.2);
		expect(buy).toBeGreaterThan(0);
		expect(sell).toBeLessThan(1);
		expect(buy).toBeLessThan(sell);
	});

	it("says how far through the band the price is, held to 0 to 100", () => {
		expect(inBand(120, 118.8, 121.2)).toBe(50);
		expect(inBand(100, 118.8, 121.2)).toBe(0);
		expect(inBand(200, 118.8, 121.2)).toBe(100);
	});

	it("shows the price large, the band's lines, and where it sits", () => {
		render(<BandDial buy={118.8} sell={121.2} price={120} />);

		expect(screen.getByText("120.00")).toBeInTheDocument();
		expect(screen.getByText("BUY 118.80")).toBeInTheDocument();
		expect(screen.getByText("SELL 121.20")).toBeInTheDocument();
		expect(screen.getByText("IN_BAND 50%")).toBeInTheDocument();
	});
});
