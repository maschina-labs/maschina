import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlankPage } from "./blank-page.tsx";

const AUTH = "https://auth.maschina.dev";

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
	);
});

describe("a blank page", () => {
	it("is the header and the footer with a full screen of nothing between them", () => {
		render(<BlankPage authUrl={AUTH} title="Pricing" />);
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
		const main = screen.getByRole("main");
		// Nothing on it that can be seen: no text, no pictures, no controls.
		expect(main.querySelectorAll("img, svg, canvas, a, button, p, section")).toHaveLength(0);
		// A whole screen of space between them, the full height with the browser's bars gone, so the footer starts below the fold.
		expect(main.className).toContain("min-h-lvh");
		expect(main.className).not.toContain("flex-1");
	});

	it("still has its name, unseen, as the page's one heading, so a reader who cannot see and a search engine know where they are", () => {
		render(<BlankPage authUrl={AUTH} title="Pricing" />);
		const heading = within(screen.getByRole("main")).getByRole("heading", {
			level: 1,
			name: "Pricing",
		});
		expect(heading.className).toContain("sr-only");
	});

	it("names the browser tab after the page, and puts the name back when it goes", () => {
		document.title = "Maschina";
		const view = render(<BlankPage authUrl={AUTH} title="Pricing" />);
		expect(document.title).toBe("Pricing · Maschina");
		view.unmount();
		expect(document.title).toBe("Maschina");
	});
});
