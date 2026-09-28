import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SolPriceView } from "./sol-price.tsx";

describe("the SOL price on the terminal", () => {
	it("shows the price to the cent and the day's move", () => {
		render(<SolPriceView price={{ usd: 118.62645, change24h: -2.2053 }} />);

		expect(screen.getByText("118.63")).toBeInTheDocument();
		expect(screen.getByText("▼")).toBeInTheDocument();
		expect(screen.getByText(/2\.21% 24H/)).toBeInTheDocument();
		expect(screen.queryByText(/[-−+]2\.21/)).not.toBeInTheDocument();
	});

	it("marks a rise with a triangle, not a plus", () => {
		render(<SolPriceView price={{ usd: 120, change24h: 1.5 }} />);

		expect(screen.getByText("▲")).toBeInTheDocument();
		expect(screen.getByText(/1\.50% 24H/)).toBeInTheDocument();
	});

	it("holds its place while the first price is on its way", () => {
		render(<SolPriceView price={undefined} />);

		expect(screen.getByText("…")).toBeInTheDocument();
	});
});
