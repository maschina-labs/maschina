import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Frame } from "./frame.tsx";

vi.mock("./header.tsx", () => ({ Header: () => <header /> }));
vi.mock("./footer.tsx", () => ({ Footer: () => <footer /> }));
vi.mock("./preferences-toast.tsx", () => ({ PreferencesToast: () => null }));
vi.mock("./pull-refresh.tsx", () => ({
	PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
describe("internal page framing", () => {
	it("frames internal content without changing it and lets the homepage manage its own rails", () => {
		const view = render(
			<Frame authUrl="/auth">
				<h1>Existing page</h1>
			</Frame>,
		);
		expect(screen.getByRole("main")).toHaveClass("document-frame");
		expect(screen.getByRole("heading")).toHaveTextContent("Existing page");
		view.rerender(
			<Frame authUrl="/auth" framed={false}>
				<h1>Existing page</h1>
			</Frame>,
		);
		expect(screen.getByRole("main")).not.toHaveClass("document-frame");
	});
});
