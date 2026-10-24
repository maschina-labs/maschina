import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Builders } from "./builders.tsx";

describe("the saved builder section", () => {
	it("keeps its source link and documentation usable", () => {
		render(<Builders />);
		expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "View the code" })).toHaveAttribute(
			"href",
			"https://github.com/maschina-labs/maschina",
		);
		expect(screen.getByRole("link", { name: "Read the docs" })).toHaveAttribute("href", "/docs");
	});
	it("preserves the actual TypeScript sample and decorative streaming lifecycle", () => {
		const { container } = render(<Builders />);
		const code = container.querySelector("[data-code]");
		expect(code).toHaveAttribute("aria-hidden", "true");
		expect(code).toHaveTextContent("machineLimits");
		expect(container.querySelector("[data-stream]")).toHaveClass(
			"animate-stream",
			"motion-reduce:animate-none",
		);
		expect(container.querySelectorAll("[data-line]").length).toBeGreaterThan(10);
		expect(container.innerHTML).not.toContain("rounded");
	});
});
