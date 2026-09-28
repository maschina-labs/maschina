import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MachineSummary } from "../lib/machines.ts";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
}));

const { NewMachineButton, SearchBox } = await import("./header-tools.tsx");
const { OPEN_PALETTE } = await import("./command-palette.tsx");
const { TickerView } = await import("./ticker.tsx");

describe("the header's tools", () => {
	it("opens the command palette from the search box", () => {
		const opened = vi.fn();
		window.addEventListener(OPEN_PALETTE, opened);
		render(<SearchBox />);

		fireEvent.click(screen.getByRole("button", { name: /SEARCH/ }));
		expect(opened).toHaveBeenCalledOnce();
		window.removeEventListener(OPEN_PALETTE, opened);
	});

	it("keeps making a machine one press away", () => {
		render(<NewMachineButton />);
		expect(screen.getByRole("link", { name: "New machine" })).toHaveAttribute("href", "/new");
	});
});

describe("the ticker", () => {
	it("runs SOL and each machine's result, twice so it loops", () => {
		const machine = {
			name: "Range Finder",
			result: { realised: "630000" },
		} as unknown as MachineSummary;
		render(<TickerView machines={[machine]} price={117.75} />);

		expect(screen.getAllByText("SOL 117.75")).toHaveLength(2);
		expect(screen.getAllByText("RANGE FINDER +0.63")).toHaveLength(2);
	});
});
