import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
	useRouter: () => ({ options: { context: {} } }),
}));

const { StatusBarView } = await import("./status-bar.tsx");

describe("the status bar", () => {
	it("shows the network, SOL and how the machines stand", () => {
		render(
			<StatusBarView price={118.73} change24h={-2.1} running={1} machines={4} realised="0.63" />,
		);

		expect(screen.getByText("SOLANA MAINNET")).toBeInTheDocument();
		expect(screen.getByText("118.73")).toBeInTheDocument();
		expect(screen.getByText("▼")).toBeInTheDocument();
		expect(screen.getByText("0.63")).toBeInTheDocument();
	});

	it("leaves the machines out until someone is signed in", () => {
		render(
			<StatusBarView
				price={undefined}
				change24h={undefined}
				running={undefined}
				machines={undefined}
				realised={undefined}
			/>,
		);

		expect(screen.queryByText(/RUNNING/)).not.toBeInTheDocument();
		expect(screen.getByText("…")).toBeInTheDocument();
	});
});
