import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeaderboardView } from "./leaderboard.tsx";

describe("the leaderboard on screen", () => {
	it("numbers each machine, says paper or live, and changes window", () => {
		const onWindow = vi.fn();
		render(
			<LeaderboardView
				board={[
					{ machineId: "a", name: "Range Finder", kind: "range", realised: 630_000n, paper: false },
				]}
				window="1W"
				onWindow={onWindow}
			/>,
		);

		expect(screen.getByText("01")).toBeInTheDocument();
		expect(screen.getByText("LIVE")).toBeInTheDocument();
		expect(screen.getByText("0.63")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "1D" }));
		expect(onWindow).toHaveBeenCalledWith("1D");
	});
});
