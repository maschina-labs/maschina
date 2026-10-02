import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Greeting, greetingFor, greetingsFor, partOfDay } from "./greeting.tsx";

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
		render(<Greeting now={() => new Date(2026, 9, 1, 19, 30)} pick={0.3} />);
		fireEvent.click(screen.getByRole("button", { name: "Good evening" }));
		const input = screen.getByRole("textbox", { name: "Your name" });
		fireEvent.change(input, { target: { value: "Asher" } });
		fireEvent.keyDown(input, { key: "Enter" });

		expect(screen.getByRole("button", { name: "Good evening, Asher" })).toBeInTheDocument();
		expect(localStorage.getItem("maschina.name")).toBe("Asher");
	});

	it("forgets the name when it is cleared, and leaves it alone when editing is abandoned", () => {
		localStorage.setItem("maschina.name", "Asher");
		render(<Greeting now={() => new Date(2026, 9, 1, 8)} pick={0} />);
		fireEvent.click(screen.getByRole("button", { name: "Morning, Asher" }));
		fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
		fireEvent.click(screen.getByRole("button", { name: "Morning, Asher" }));
		const input = screen.getByRole("textbox");
		fireEvent.change(input, { target: { value: " " } });
		fireEvent.blur(input);

		expect(screen.getByRole("button", { name: "Morning" })).toBeInTheDocument();
		expect(localStorage.getItem("maschina.name")).toBeNull();
	});
});
