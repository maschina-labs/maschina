import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveApp } from "./app.tsx";

const trade = (n: number, side: "buy" | "sell") => ({
	at: `2026-10-11T12:0${n}:00.000Z`,
	side,
	usdc: "15000000",
	sol: "100000000",
	signature: `sig${n}`,
});

describe("the live record", () => {
	it("says it is reading before it has an answer", () => {
		render(<LiveApp state={{ status: "loading" }} />);
		expect(screen.getByText(/reading the record/i)).toBeInTheDocument();
	});

	it("says plainly when there is nothing on it yet, rather than showing a blank", () => {
		render(<LiveApp state={{ status: "ready", trades: [] }} />);
		expect(screen.getByText(/no trades on the record yet/i)).toBeInTheDocument();
	});

	it("lists each trade with its side, amounts, price and a link to the proof on the chain", () => {
		render(<LiveApp state={{ status: "ready", trades: [trade(1, "buy"), trade(2, "sell")] }} />);
		expect(screen.getAllByRole("row")).toHaveLength(3);
		expect(screen.getByText("Buy")).toBeInTheDocument();
		expect(screen.getByText("Sell")).toBeInTheDocument();
		expect(screen.getAllByText("15")[0]).toBeInTheDocument();
		expect(screen.getAllByText("0.1")[0]).toBeInTheDocument();
		expect(screen.getAllByText("150.00")[0]).toBeInTheDocument();
		const proof = screen.getAllByRole("link", { name: /proof/i })[0];
		expect(proof).toHaveAttribute("href", "https://solscan.io/tx/sig1");
		expect(proof).toHaveAttribute("rel", expect.stringContaining("noopener"));
	});

	it("says it could not reach the record, and that the last trades shown may be old", () => {
		render(<LiveApp state={{ status: "failed" }} />);
		expect(screen.getByRole("alert")).toHaveTextContent(/could not read the record/i);
	});
});
