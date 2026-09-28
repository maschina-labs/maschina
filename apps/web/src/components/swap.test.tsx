import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuoteView } from "./swap.tsx";

describe("a swap quote on screen", () => {
	it("shows what arrives, the least, the rate, the impact and the route", () => {
		render(
			<QuoteView
				from="USDC"
				to="SOL"
				amount={10}
				quote={{
					out: 0.084536739,
					atLeast: 0.084114056,
					impactPct: 0.12,
					route: ["Deriverse", "GoonFi V2"],
				}}
				failed={undefined}
			/>,
		);

		expect(screen.getByText("0.08454 SOL")).toBeInTheDocument();
		expect(screen.getByText("1 SOL = 118.29 USDC")).toBeInTheDocument();
		expect(screen.getByText("0.12%")).toBeInTheDocument();
		expect(screen.getByText("DERIVERSE → GOONFI V2")).toBeInTheDocument();
	});

	it("asks for an amount before quoting, and says why when it cannot", () => {
		const { rerender } = render(
			<QuoteView from="USDC" to="SOL" amount={0} quote={undefined} failed={undefined} />,
		);
		expect(screen.getByText("TYPE AN AMOUNT")).toBeInTheDocument();

		rerender(
			<QuoteView
				from="USDC"
				to="SOL"
				amount={10}
				quote={undefined}
				failed="Jupiter found no route"
			/>,
		);
		expect(screen.getByText("JUPITER FOUND NO ROUTE")).toBeInTheDocument();
	});
});
