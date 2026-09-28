import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
		<a href={to}>{children}</a>
	),
}));

const { Broken, NotFound, NotYours, OfflineBanner, SessionEnded } = await import(
	"./status-pages.tsx"
);

describe("the pages people rarely see", () => {
	it("says there is nothing here, and offers the way home", () => {
		render(<NotFound />);
		expect(screen.getByRole("alert")).toHaveTextContent("404");
		expect(screen.getByRole("link", { name: /TERMINAL/ })).toHaveAttribute("href", "/");
	});

	it("shows the real message when something breaks, and tries again", () => {
		const retry = vi.fn();
		render(<Broken detail="the gateway timed out" retry={retry} />);
		expect(screen.getByRole("alert")).toHaveTextContent("the gateway timed out");
		fireEvent.click(screen.getByRole("button", { name: "TRY AGAIN" }));
		expect(retry).toHaveBeenCalledOnce();
	});

	it("says a machine is someone else's, and that a session ended", () => {
		render(<NotYours />);
		expect(screen.getByRole("alert")).toHaveTextContent("403");
		render(<SessionEnded />);
		expect(screen.getByRole("link", { name: /SIGN IN/ })).toHaveAttribute("href", "/sign-in");
	});

	it("says so when the connection drops, and goes when it returns", () => {
		render(<OfflineBanner />);
		act(() => {
			window.dispatchEvent(new Event("offline"));
		});
		expect(screen.getByRole("status")).toHaveTextContent("OFFLINE");
		act(() => {
			window.dispatchEvent(new Event("online"));
		});
		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});
});
