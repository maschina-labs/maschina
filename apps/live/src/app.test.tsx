import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveApp } from "./app.tsx";

describe("the live record", () => {
	it("is a blank black page named Live Record until its design lands, and the tab says so", () => {
		render(<LiveApp />);
		const page = screen.getByRole("main", { name: "Live Record" });
		expect(page).toBeEmptyDOMElement();
		expect(page.className).toContain("bg-black");
		expect(document.title).toBe("Live Record | Maschina");
	});
});
