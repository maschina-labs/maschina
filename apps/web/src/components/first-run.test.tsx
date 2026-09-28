import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

const { FirstRun } = await import("./first-run.tsx");

describe("the first run", () => {
	it("starts with connecting", () => {
		render(<FirstRun connected={false} hasMachine={false} />);

		expect(screen.getByText("STEP 1")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /MAKE ONE/ })).not.toBeInTheDocument();
	});

	it("ticks connecting off and points at a paper machine next", () => {
		render(<FirstRun connected hasMachine={false} />);

		expect(screen.getByText("DONE")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /MAKE ONE/ })).toHaveAttribute("href", "/machines");
	});

	it("goes away once there is a machine", () => {
		const { container } = render(<FirstRun connected hasMachine />);

		expect(container).toBeEmptyDOMElement();
	});
});
