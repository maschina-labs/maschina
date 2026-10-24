import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EvidenceSection } from "./evidence-section.tsx";

afterEach(() => vi.unstubAllGlobals());
const live = {
	at: "2026-10-21T12:00:00Z",
	side: "buy",
	sol: "123456789",
	usdc: "15000000",
	signature: "real-signature",
};
describe("evidence section", () => {
	it("shows actual trade amounts and links only real signatures", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						live: [live],
						paper: [{ at: live.at, side: "sell", sol: "999000000000", usdc: "999000000000" }],
						refused: [],
					}),
				),
			),
		);
		render(<EvidenceSection />);
		expect(await screen.findByText("0.123456789 SOL")).toBeInTheDocument();
		expect(screen.getByText("15 USDC")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Verify transaction/ })).toHaveAttribute(
			"href",
			"https://solscan.io/tx/real-signature",
		);
		expect(screen.queryByText(/999/)).not.toBeInTheDocument();
	});
	it("rejects invalid records and lets the reader retry", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(new Response("{}"))
			.mockResolvedValueOnce(new Response(JSON.stringify({ live: [], paper: [], refused: [] })));
		vi.stubGlobal("fetch", fetcher);
		render(<EvidenceSection />);
		await screen.findByText("The public record is temporarily unavailable.");
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(
			await screen.findByText("No completed real-money trades are available yet."),
		).toBeInTheDocument();
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
