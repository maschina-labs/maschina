import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MachineDetail } from "../lib/machines.ts";
import { Decisions, WorkBar } from "./at-work.tsx";

const machine = {
	name: "Range Finder",
	state: "running",
	settings: { buyLevel: "118800000", sellLevel: "121200000" },
	budget: { granted: "40600000" },
	result: { position: "0", trades: 0 },
} as unknown as MachineDetail;

const entry = (id: string, type: string, at: string) => ({ id, type, occurredAt: at, payload: {} });

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

	it("shows its last three decisions, newest first, in plain words", () => {
		render(
			<Decisions
				record={[
					entry("1", "machine.created", "2026-09-28T05:20:00Z"),
					entry("2", "machine.limits_changed", "2026-09-28T05:20:01Z"),
					entry("3", "machine.started", "2026-09-28T05:22:33Z"),
					entry("4", "run.queued", "2026-09-28T07:00:00Z"),
				]}
			/>,
		);

		const titles = screen.getAllByRole("listitem").map((item) => item.children[1]?.textContent);
		expect(titles).toEqual(["WOKE UP", "STARTED", "LIMIT SET"]);
	});
});
