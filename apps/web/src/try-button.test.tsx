import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TryButton } from "./try-button.tsx";

const props = { href: "/x", className: "flex", labelClassName: "", chipClassName: "size-7" };

describe("the try button", () => {
	it("has no glint unless asked for: the header's button stays plain", () => {
		render(<TryButton {...props} />);
		expect(screen.getByRole("link").querySelector("[data-glint]")).toBeNull();
	});

	it("can carry a glint that sweeps across on hover, hidden from assistive technology", () => {
		render(<TryButton {...props} glint />);
		const link = screen.getByRole("link", { name: "Try Maschina" });
		const glint = link.querySelector("[data-glint]");
		expect(glint).toHaveAttribute("aria-hidden", "true");
		expect(link.className).toContain("overflow-hidden");
		expect(link.className).toContain("group");
		expect(glint?.className).toContain("group-hover:translate-x-");
		expect(glint?.className).toContain("motion-reduce:hidden");
		expect(glint?.className).toContain("pointer-events-none");
	});
});
