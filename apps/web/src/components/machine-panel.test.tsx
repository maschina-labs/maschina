import { followingRange } from "@maschina/runtime";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MachineDetail } from "../lib/machines.ts";
import { MachinePanelView } from "./machine-panel.tsx";

const machine = (state: MachineDetail["state"], actions: MachineDetail["actions"]) =>
	({
		machineId: "m",
		name: "Range Finder",
		kind: "range",
		state,
		walletAddress: "6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXaHy",
		createdAt: "2026-09-28T05:20:13Z",
		budget: { granted: "40600000", reserved: "0", settled: "0", available: "40600000" },
		result: {
			realised: "0",
			position: "0",
			basis: "0",
			feesLamports: "0",
			trades: 0,
			roundTrips: 0,
			wins: 0,
			losses: 0,
			simulated: false,
		},
		settings: { buyLevel: "118800000", sellLevel: "121200000", amountPerBuy: "40350000" },
		limits: {
			maxPerTrade: "40350000",
			maxPerDay: "40600000",
			approvedMints: [
				"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				"So11111111111111111111111111111111111111112",
			],
		},
		actions,
	}) as MachineDetail;

const view = (
	detail: MachineDetail,
	handlers: { onAction?: () => void; onWithdraw?: () => void } = {},
) =>
	render(
		<MachinePanelView
			machine={detail}
			record={[
				{ id: "e", type: "machine.started", occurredAt: "2026-09-28T05:22:33Z", payload: {} },
			]}
			busy={false}
			onAction={handlers.onAction ?? vi.fn()}
			onWithdraw={handlers.onWithdraw ?? vi.fn()}
		/>,
	);

describe("the selected machine", () => {
	it("shows its band, what it spends, and its wallet", () => {
		view(machine("running", ["pause", "stop"]));

		expect(screen.getByText("BUY 118.80")).toBeInTheDocument();
		expect(screen.getByText("SELL 121.20")).toBeInTheDocument();
		expect(screen.getByText("EACH BUY 40.35 USDC")).toBeInTheDocument();
		expect(screen.getByText("WAITING TO BUY AT 118.80")).toBeInTheDocument();
		expect(screen.getByText("6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXaHy")).toBeInTheDocument();
	});

	it("offers exactly the controls the API allows, and runs the one pressed", () => {
		const onAction = vi.fn();
		view(machine("running", ["pause", "stop"]), { onAction });

		const actions = screen.getAllByRole("button").map((b) => b.textContent);
		expect(actions).toEqual(expect.arrayContaining(["PAUSE", "STOP"]));
		expect(actions).not.toContain("START");
		expect(actions).not.toContain("WITHDRAW EVERYTHING");
		fireEvent.click(screen.getByRole("button", { name: "STOP" }));
		// Stopping is asked about first, and only happens once confirmed.
		expect(onAction).not.toHaveBeenCalled();
		const dialog = screen.getByRole("alertdialog", { name: "STOP RANGE FINDER?" });
		expect(dialog).toHaveTextContent("IT WILL NEVER ACT AGAIN.");
		fireEvent.click(within(dialog).getByRole("button", { name: "STOP" }));
		expect(onAction).toHaveBeenCalledWith("stop");
	});

	it("offers to withdraw everything only once it has stopped acting", () => {
		const onWithdraw = vi.fn();
		view(machine("stopped", []), { onWithdraw });

		fireEvent.click(screen.getByRole("button", { name: "WITHDRAW EVERYTHING" }));
		fireEvent.click(screen.getByRole("button", { name: "WITHDRAW" }));
		expect(onWithdraw).toHaveBeenCalledOnce();
	});

	it("shows its record", () => {
		view(machine("running", []));

		expect(screen.getByText("STARTED")).toBeInTheDocument();
		expect(screen.getByText("WATCHING THE PRICE")).toBeInTheDocument();
	});

	it("shows its band as a dial with the live price in the middle", () => {
		render(
			<MachinePanelView
				machine={machine("running", [])}
				record={[]}
				price={120}
				busy={false}
				onAction={vi.fn()}
				onWithdraw={vi.fn()}
			/>,
		);

		expect(screen.getByText("120.00")).toBeInTheDocument();
		expect(screen.getByText("IN_BAND 50%")).toBeInTheDocument();
	});

	it("does nothing when a question is cancelled", () => {
		const onAction = vi.fn();
		view(machine("running", ["pause", "stop"]), { onAction });

		fireEvent.click(screen.getByRole("button", { name: "PAUSE" }));
		fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
		expect(onAction).not.toHaveBeenCalled();
		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
	});

	it("shows its limits, by the names people know its tokens by", () => {
		view(machine("running", []));

		expect(screen.getByText("PER TRADE 40.35")).toBeInTheDocument();
		expect(screen.getByText("PER DAY 40.60")).toBeInTheDocument();
		expect(screen.getByText("TRADES ONLY USDC · SOL")).toBeInTheDocument();
	});

	it("never offers to retire a machine before that can be done safely", () => {
		view(machine("stopped", []));

		expect(screen.getByRole("button", { name: "RETIRE THIS MACHINE" })).toBeDisabled();
	});
});

describe("a machine whose band follows the price", () => {
	const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
	const SOL = "So11111111111111111111111111111111111111112";

	it("shows where its band sits now, from its record", () => {
		const following = {
			...machine("running", ["pause", "stop"]),
			kind: followingRange.kind,
			settings: { quoteMint: USDC, baseMint: SOL, bandBps: 250, amountPerBuy: "40350000" },
		} as MachineDetail;
		render(
			<MachinePanelView
				machine={following}
				record={[
					{
						id: "c",
						type: "machine.recentred",
						occurredAt: "2026-09-28T19:22:24Z",
						payload: { price: "120000000", because: "started" },
					},
				]}
				busy={false}
				onAction={vi.fn()}
				onWithdraw={vi.fn()}
			/>,
		);

		expect(screen.getByText("FOLLOW 121.50")).toBeInTheDocument();
		expect(screen.getByText("BUY 118.50")).toBeInTheDocument();
		expect(screen.getByText("WAITING TO BUY AT 118.50")).toBeInTheDocument();
	});
});

describe("the panel's other controls", () => {
	it("renames, copies its link and shares its result", () => {
		const writeText = vi.fn(async () => undefined);
		Object.assign(navigator, { clipboard: { writeText } });
		view(machine("running", []));

		fireEvent.click(screen.getByRole("button", { name: "RENAME" }));
		expect(screen.getByRole("textbox", { name: /NEW NAME/ })).toHaveValue("Range Finder");
		fireEvent.click(screen.getByRole("button", { name: "COPY LINK" }));
		expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/machines/m"));
		fireEvent.click(screen.getByRole("button", { name: "SHARE" }));
		expect(screen.getByText(/118\.80 TO 121\.20/)).toBeInTheDocument();
	});

	it("reads its track record from trades, and says it is on paper", () => {
		const onPaper = {
			...machine("paused", ["resume"]),
			result: { ...machine("paused", []).result, simulated: true },
		} as MachineDetail;
		render(
			<MachinePanelView
				machine={onPaper}
				record={[
					{
						id: "c",
						type: "trade.completed",
						occurredAt: "2026-09-28T06:22:39Z",
						payload: { tradeId: "t", inputAmount: "40350000", outputAmount: "339698787" },
					},
					{
						id: "i",
						type: "trade.intended",
						occurredAt: "2026-09-28T06:22:36Z",
						payload: {
							tradeId: "t",
							inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
							outputMint: "So11111111111111111111111111111111111111112",
							inputAmount: "40350000",
							quotedOutputAmount: "339000000",
						},
					},
				]}
				price={121}
				busy={false}
				onAction={vi.fn()}
				onWithdraw={vi.fn()}
			/>,
		);

		expect(screen.getByText(/FEES NONE, IT IS ON PAPER/)).toBeInTheDocument();
		expect(screen.getByText(/BPS VS QUOTE/)).toBeInTheDocument();
		expect(screen.getByText(/SINCE ITS FIRST BUY/)).toBeInTheDocument();
		// Resuming is not asked about; it happens when pressed.
		fireEvent.click(screen.getByRole("button", { name: "RESUME" }));
	});
});

describe("what the machine holds, from the chain", () => {
	it("shows its wallet, its vault, and the SOL it keeps for fees", () => {
		render(
			<MachinePanelView
				machine={{
					...machine("running", []),
					result: { ...machine("running", []).result, position: "339698787" },
				}}
				record={[]}
				balances={{
					wallet: {
						address: "w",
						lamports: "351698787",
						tokens: [
							{
								mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
								amount: "250000",
								decimals: 6,
							},
						],
					},
					vault: {
						address: "v",
						lamports: "0",
						tokens: [
							{
								mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
								amount: "1010000",
								decimals: 6,
							},
						],
					},
				}}
				busy={false}
				onAction={vi.fn()}
				onWithdraw={vi.fn()}
			/>,
		);

		expect(screen.getByText("IN ITS WALLET 0.25 USDC · 0.3517 SOL")).toBeInTheDocument();
		expect(screen.getByText("1.01 USDC")).toBeInTheDocument();
		expect(screen.getByText("0.0120 SOL")).toBeInTheDocument();
	});

	it("warns when the SOL for fees runs low", () => {
		render(
			<MachinePanelView
				machine={machine("running", [])}
				record={[]}
				balances={{ wallet: { address: "w", lamports: "3000000", tokens: [] } }}
				busy={false}
				onAction={vi.fn()}
				onWithdraw={vi.fn()}
			/>,
		);

		expect(screen.getByText(/TOP IT UP/)).toBeInTheDocument();
	});
});
