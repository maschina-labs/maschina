import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MachineDetail } from "../lib/machines.ts";
import { ResultCard, resultText } from "./result-card.tsx";

const machine = {
	name: "Range Finder",
	kind: "range",
	result: { realised: "630000", trades: 2, wins: 1, losses: 0, simulated: false },
} as unknown as MachineDetail;

describe("a machine's result card", () => {
	it("reads as text for pasting anywhere", () => {
		expect(resultText(machine, "118.80 TO 121.20").split("\n")).toEqual([
			"RANGE FINDER // RANGE",
			"REALISED 0.63 USDC · 2 TRADES · WON 100%",
			"BAND 118.80 TO 121.20",
			"RUN BY A MACHINE ON MASCHINA",
		]);
	});

	it("shows the figures, copies, and holds posting back until chat can carry it", () => {
		render(<ResultCard machine={machine} band={undefined} onClose={vi.fn()} />);

		expect(screen.getByText("0.63")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "COPY AS TEXT" })).toBeEnabled();
		expect(screen.getByRole("button", { name: "POST TO GLOBAL CHAT" })).toBeDisabled();
	});
});
