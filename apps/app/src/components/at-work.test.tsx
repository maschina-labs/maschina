import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MachineDetail } from "../lib/machines.ts";
import { WorkBar } from "./at-work.tsx";

const machine = {
	name: "Range Finder",
	state: "running",
	settings: { buyLevel: "118800000", sellLevel: "121200000" },
	budget: { granted: "40600000" },
	result: { position: "0", trades: 0 },
} as unknown as MachineDetail;

describe("the machine at work", () => {
	it("says what it is doing, its float and its trades", () => {
		render(<WorkBar machine={machine} />);

		expect(screen.getByText("RANGE FINDER")).toBeInTheDocument();
		expect(screen.getByText("WAITING TO BUY AT 118.80")).toBeInTheDocument();
		expect(screen.getByText("FLOAT 40.60 USDC")).toBeInTheDocument();
		expect(screen.getByText("0 TRADES")).toBeInTheDocument();
	});

	it("asks to connect when there is no machine to show", () => {
		render(<WorkBar machine={undefined} />);

		expect(screen.getByText("CONNECT TO SEE YOUR MACHINE AT WORK")).toBeInTheDocument();
	});
});
