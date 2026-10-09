import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Greeting, greetingFor, greetingsFor, newcomerGreeting, partOfDay } from "./greeting.tsx";

afterEach(() => localStorage.clear());

describe("the greeting", () => {
	it.each([
		[5, "morning"],
		[11, "morning"],
		[12, "afternoon"],
		[16, "afternoon"],
		[17, "evening"],
		[23, "evening"],
		[2, "evening"],
	])("at %i o'clock is %s", (hour, part) => {
		expect(partOfDay(hour)).toBe(part);
	});

	it("only ever offers greetings that suit the hour", () => {
		expect(greetingsFor(8)).toEqual([
			"Morning",
			"Good morning",
			"Hello",
			"Welcome back",
			"Back again",
		]);
		expect(greetingsFor(23).some((said) => said.includes("morning"))).toBe(false);
	});

	it("puts the name after the greeting, and leaves it off when there is none", () => {
		expect(greetingFor(20, "Asher", 0)).toBe("Evening, Asher");
		expect(greetingFor(20, "", 0.99)).toBe("Back again");
	});

	it("keeps the same greeting while open, and greets by name once given one", () => {
		render(<Greeting now={() => new Date(2026, 9, 1, 19, 30)} pick={0.3} wallet="W" />);
		fireEvent.click(screen.getByRole("button", { name: "Good evening" }));
		const input = screen.getByRole("textbox", { name: "Your name" });
		fireEvent.change(input, { target: { value: "Asher" } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(screen.getByRole("button", { name: "Good evening, Asher" })).toBeInTheDocument();
		expect(localStorage.getItem("maschina.name:W")).toBe("Asher");
	});

	it("forgets the name when it is cleared, and leaves it alone when editing is abandoned", () => {
		localStorage.setItem("maschina.name:W", "Asher");
		render(<Greeting now={() => new Date(2026, 9, 1, 8)} pick={0} wallet="W" />);
		fireEvent.click(screen.getByRole("button", { name: "Morning, Asher" }));
		fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
		fireEvent.click(screen.getByRole("button", { name: "Morning, Asher" }));
		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: " " } });
		fireEvent.blur(input);

		expect(screen.getByRole("button", { name: "Morning" })).toBeInTheDocument();
		expect(localStorage.getItem("maschina.name:W")).toBeNull();
	});

	it("remembers a name for each wallet, and a welcome stands in while signed out", () => {
		const evening = () => new Date(2026, 9, 1, 19, 30);
		const first = render(<Greeting now={evening} pick={0.3} wallet="WalletA" />);
		fireEvent.click(screen.getByRole("button", { name: "Good evening" }));
		const input = screen.getByRole("textbox", { name: "Your name" });
		fireEvent.change(input, { target: { value: "Asher" } });
		fireEvent.keyDown(input, { key: "Enter" });
		first.unmount();

		// Signed out: still Asher, because WalletA was the last wallet here.
		// Signed out, a welcome stands in for the greeting.
		const out = render(<Greeting now={evening} pick={0.3} />);
		expect(screen.getByText("Welcome to Maschina")).toBeInTheDocument();
		out.unmount();

		// Back with the same wallet, the name is still there.
		const back = render(<Greeting now={evening} pick={0.3} wallet="WalletA" />);
		expect(screen.getByRole("button", { name: "Good evening, Asher" })).toBeInTheDocument();
		back.unmount();

		// Another wallet has no name of its own yet.
		render(<Greeting now={evening} pick={0.3} wallet="WalletB" />);
		expect(screen.getByRole("button", { name: "Good evening" })).toBeInTheDocument();
	});

	it("signed out, welcomes a newcomer instead of naming a time of day", () => {
		render(<Greeting now={() => new Date(2026, 9, 1, 8)} pick={0.5} />);
		expect(screen.getByText("Glad you're here")).toBeInTheDocument();
		expect(screen.queryByText("Morning")).toBeNull();
		expect(newcomerGreeting(0.99)).toBe("Hello, newcomer");
	});
});
