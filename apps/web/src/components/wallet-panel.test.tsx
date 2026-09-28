import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MachineSummary } from "../lib/machines.ts";
import { WalletPanelView } from "./wallet-panel.tsx";

const owner = { ownerId: "o", walletAddress: "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR" };
const machine = {
	machineId: "m",
	name: "Range Finder",
	walletAddress: "6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXaHy",
	budget: { granted: "40600000" },
} as MachineSummary;

const view = (handlers: { onClose?: () => void; onDisconnect?: () => void } = {}) =>
	render(
		<WalletPanelView
			owner={owner}
			machines={[machine]}
			onClose={handlers.onClose ?? vi.fn()}
			onDisconnect={handlers.onDisconnect ?? vi.fn()}
		/>,
	);

describe("the wallet panel", () => {
	it("shows your address", () => {
		view();

		expect(screen.getByText(owner.walletAddress)).toBeInTheDocument();
	});

	it("fills in what a machine needs from its own settings once one is picked", () => {
		view();

		fireEvent.click(screen.getByRole("button", { name: "RANGE FINDER" }));
		expect(screen.getByText("SENDS 40.60 USDC")).toBeInTheDocument();
		expect(screen.getByText("AND 0.011 SOL FOR ITS FEES")).toBeInTheDocument();
		expect(screen.getByText(`TO ${machine.walletAddress}`)).toBeInTheDocument();
	});

	it("does not pretend to fund before signing is wired in", () => {
		view();

		fireEvent.click(screen.getByRole("button", { name: "RANGE FINDER" }));
		expect(screen.getByRole("button", { name: "FUND · ONE APPROVAL" })).toBeDisabled();
	});

	it("closes, and disconnects", () => {
		const onClose = vi.fn();
		const onDisconnect = vi.fn();
		view({ onClose, onDisconnect });

		fireEvent.click(screen.getByRole("button", { name: "Close" }));
		fireEvent.click(screen.getByRole("button", { name: "DISCONNECT" }));
		expect(onClose).toHaveBeenCalledOnce();
		expect(onDisconnect).toHaveBeenCalledOnce();
	});
});
