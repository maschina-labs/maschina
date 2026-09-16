import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button.tsx";

describe("Button", () => {
	it("renders a non-submitting button by default", () => {
		render(<Button>Stop</Button>);
		const button = screen.getByRole("button", { name: "Stop" });
		expect(button).toHaveAttribute("type", "button");
		expect(button.className).toContain("bg-primary");
	});

	it("applies variants and lets callers add classes", () => {
		render(
			<Button variant="destructive" size="lg" className="w-full">
				Stop all machines
			</Button>,
		);
		const button = screen.getByRole("button");
		expect(button.className).toContain("bg-destructive");
		expect(button.className).toContain("h-10");
		expect(button.className).toContain("w-full");
	});

	it("does nothing when disabled", () => {
		const onClick = vi.fn();
		render(
			<Button disabled onClick={onClick}>
				Stop
			</Button>,
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onClick).not.toHaveBeenCalled();
	});
});
