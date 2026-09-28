import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ signedIn: true, feed: [] as unknown[] }));

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		search,
		activeProps: _,
		...rest
	}: {
		children: React.ReactNode;
		to: string;
		search?: { machine?: string };
		activeProps?: unknown;
	}) => (
		<a href={search?.machine ? `${to}?machine=${search.machine}` : to} {...rest}>
			{children}
		</a>
	),
	useRouter: () => ({ options: { context: { api: {} } } }),
	useSearch: () => ({ machine: "a" }),
}));
vi.mock("../lib/session.ts", () => ({
	useSession: () => ({ data: state.signedIn ? { ownerId: "o" } : null }),
}));
vi.mock("../lib/machines.ts", async (real) => ({
	...(await real<object>()),
	useMachines: () => ({
		data: [
			{ machineId: "a", name: "Range Finder", kind: "following_range", state: "running" },
			{ machineId: "b", name: "Dip Buyer", kind: "range", state: "paused" },
		],
	}),
}));
vi.mock("./portfolio.tsx", () => ({ useActivity: () => state.feed }));
vi.mock("./chat-panel.tsx", () => ({
	ChatPanel: ({ onClose }: { onClose: () => void }) => (
		<button type="button" onClick={onClose}>
			CLOSE CHAT
		</button>
	),
}));

const { LeftRail, RightRail } = await import("./rails.tsx");

const entry = (id: string, type: string, occurredAt: string) => ({
	id,
	type,
	occurredAt,
	payload: {},
	machineId: "a",
	machineName: "Range Finder",
});

beforeEach(() => {
	state.signedIn = true;
	state.feed = [
		entry("1", "trade.completed", "2099-01-01T00:00:00Z"),
		entry("2", "machine.started", "2026-09-28T05:00:00Z"),
	];
	try {
		localStorage.clear();
	} catch {}
});

describe("your machines on the left", () => {
	it("lists them, each one a link that makes the terminal follow it", () => {
		render(<LeftRail />);

		expect(screen.getByRole("link", { name: /RANGE FINDER/ })).toHaveAttribute(
			"href",
			"/?machine=a",
		);
		expect(screen.getByRole("link", { name: /RANGE FINDER/ })).toHaveAttribute(
			"aria-current",
			"true",
		);
		expect(screen.getByRole("link", { name: "+ NEW MACHINE" })).toHaveAttribute("href", "/new");
	});

	it("asks you to connect first", () => {
		state.signedIn = false;
		render(<LeftRail />);
		expect(screen.getByText("CONNECT TO SEE YOUR MACHINES")).toBeInTheDocument();
	});
});

describe("the right side", () => {
	it("shows what the machines are doing, live", () => {
		render(<RightRail />);
		expect(screen.getByRole("complementary", { name: "Right" })).toHaveTextContent("TRADED");
	});

	it("says so when nothing has happened", () => {
		state.feed = [];
		render(<RightRail />);
		expect(screen.getByText("NOTHING YET")).toBeInTheDocument();
	});

	it("counts alerts not yet seen, and clears the count once they are opened", () => {
		render(<RightRail />);
		const bell = screen.getByRole("button", { name: /Alerts, 1 new/ });

		fireEvent.click(bell);
		expect(screen.getByRole("complementary", { name: "Alerts" })).toHaveTextContent("TRADED");
		expect(screen.getByRole("button", { name: "Alerts" })).toBeInTheDocument();
	});

	it("says there is nothing to tell when there are no alerts", () => {
		state.feed = [];
		render(<RightRail />);
		fireEvent.click(screen.getByRole("button", { name: "Alerts" }));
		expect(screen.getByText("NOTHING TO TELL YOU YET")).toBeInTheDocument();
	});

	it("opens chat docked, closes it again, and closes whichever tool is pressed twice", () => {
		render(<RightRail />);
		fireEvent.click(screen.getByRole("button", { name: "Chat" }));
		fireEvent.click(screen.getByRole("button", { name: "CLOSE CHAT" }));
		expect(screen.queryByRole("complementary", { name: "Chat window" })).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Live" }));
		expect(screen.getByRole("complementary", { name: "Right" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Live" }));
		expect(screen.queryByRole("complementary", { name: "Right" })).not.toBeInTheDocument();
	});
});
