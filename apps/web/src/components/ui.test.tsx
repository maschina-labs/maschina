import { Pulse } from "@phosphor-icons/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, Empty, Failed, Loading, Meter, Metric, Payload, Pill, Row } from "./ui.tsx";

describe("buttons", () => {
	it("says what it does, and does it", () => {
		const press = vi.fn();
		render(
			<Button tone="primary" icon={Pulse} onClick={press}>
				Start
			</Button>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Start/ }));
		expect(press).toHaveBeenCalledOnce();
	});

	it("keeps a destructive action outlined rather than filled", () => {
		render(<Button tone="danger">Stop</Button>);

		// Reachable without being loud: red is a border and a label, never a filled block.
		const stop = screen.getByRole("button", { name: "Stop" });
		expect(stop.className).toContain("border-danger");
		expect(stop.className).not.toContain("bg-danger ");
	});

	it("cannot be pressed while it is disabled", () => {
		const press = vi.fn();
		render(
			<Button disabled onClick={press}>
				Set
			</Button>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Set" }));
		expect(press).not.toHaveBeenCalled();
	});
});

describe("a status pill", () => {
	it("breathes only when something is live", () => {
		const { rerender } = render(
			<Pill tone="live" dot>
				running
			</Pill>,
		);
		expect(document.querySelector(".animate-live")).toBeTruthy();

		rerender(<Pill tone="quiet">stopped</Pill>);
		expect(document.querySelector(".animate-live")).toBeNull();
	});
});

describe("the budget meter", () => {
	it("shows spend and holdings as shares of what was granted", () => {
		const { container } = render(<Meter granted={50} held={5} spent={10} />);
		const [spent, held] = [...(container.firstElementChild?.children ?? [])];

		expect((spent as HTMLElement).style.width).toBe("20%");
		expect((held as HTMLElement).style.width).toBe("10%");
	});

	it("shows nothing rather than dividing by nothing when no budget was granted", () => {
		const { container } = render(<Meter granted={0} held={0} spent={0} />);
		const [spent] = [...(container.firstElementChild?.children ?? [])];

		expect((spent as HTMLElement).style.width).toBe("0%");
	});

	it("never runs past the end of the bar", () => {
		// Settling above the grant should be impossible, and if it happens the bar still has an end.
		const { container } = render(<Meter granted={10} held={0} spent={40} />);
		const [spent] = [...(container.firstElementChild?.children ?? [])];

		expect((spent as HTMLElement).style.width).toBe("100%");
	});
});

describe("a payload", () => {
	it("stays folded until somebody asks for it", () => {
		render(<Payload value={{ runId: "r1", reason: "other" }} />);

		expect(screen.queryByText(/runId/)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: /payload/ }));
		expect(screen.getByText(/runId/)).toBeTruthy();
	});

	it("is not offered at all when there is nothing in it", () => {
		render(<Payload value={{}} />);

		expect(screen.queryByRole("button")).toBeNull();
	});
});

describe("the small pieces", () => {
	it("puts a label above a number, with its unit kept quiet", () => {
		render(<Metric label="Granted" value="50.00" unit="USDC" tone="accent" />);

		expect(screen.getByText("Granted")).toBeTruthy();
		expect(screen.getByText("50.00")).toBeTruthy();
		expect(screen.getByText("USDC")).toBeTruthy();
	});

	it("puts a fact on one line", () => {
		render(<Row label="Most per trade">5.00</Row>);

		expect(screen.getByText("Most per trade")).toBeTruthy();
		expect(screen.getByText("5.00")).toBeTruthy();
	});
});

describe("the states every screen can be in", () => {
	it("names what is missing and offers the thing that fixes it", () => {
		render(
			<Empty
				icon={Pulse}
				title="No machines yet"
				note="A machine is a job and a budget."
				action={<Button>Make one</Button>}
			/>,
		);

		expect(screen.getByText("No machines yet")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Make one" })).toBeTruthy();
	});

	it("shows the real message rather than something friendlier", () => {
		const retry = vi.fn();
		render(<Failed detail="balance_too_low: a trade needs 5000000" retry={retry} />);

		expect(screen.getByText("balance_too_low: a trade needs 5000000")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(retry).toHaveBeenCalledOnce();
	});

	it("says it is loading to anybody who cannot see it", () => {
		render(<Loading rows={2} />);

		expect(screen.getByText("Loading")).toBeTruthy();
	});
});
