import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MachineTapeView, MarketTapeView } from "./tapes.tsx";

describe("the tapes", () => {
	it("shows market trades with their side, price and size", () => {
		render(
			<MarketTapeView
				prints={[{ id: 1, price: 118.42, size: 3.1, at: 1790560000000, side: "sell" }]}
			/>,
		);

		expect(screen.getByText("▼")).toBeInTheDocument();
		expect(screen.getByText("3.10 SOL")).toBeInTheDocument();
	});

	it("shows machines' trades by machine, not by owner", () => {
		render(
			<MachineTapeView
				trades={[{ machine: "RANGE FINDER", at: 1790560000000, side: "buy", price: 118.78 }]}
			/>,
		);

		expect(screen.getByText("RANGE FINDER · BOUGHT")).toBeInTheDocument();
		expect(screen.getByText("AT 118.78")).toBeInTheDocument();
	});
});
