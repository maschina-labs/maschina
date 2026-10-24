import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveApp } from "./app.tsx";

const live = {
	at: "2026-10-11T12:00:00.000Z",
	side: "buy" as const,
	usdc: "40350000",
	sol: "340000000",
	signature: "4".repeat(88),
};
const onPaper = {
	at: "2026-10-11T13:00:00.000Z",
	side: "sell" as const,
	usdc: "24360000",
	sol: "196600000",
};

const stopped = {
	at: "2026-10-11T14:00:00.000Z",
	side: "buy" as const,
	usdc: "500000000",
	sol: "4200000000",
	by: "maschina" as const,
	rule: "budget" as const,
};

const answering = (body: unknown, status = 200) =>
	vi.fn(
		async () =>
			new Response(JSON.stringify(body), {
				status,
				headers: { "content-type": "application/json" },
			}),
	);

const show = (body: unknown, status = 200) => {
	vi.stubGlobal("fetch", answering(body, status));
	render(<LiveApp />);
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("the live record", () => {
	it("names the page and the tab", async () => {
		show({ live: [], paper: [], refused: [] });

		expect(screen.getByRole("main", { name: "Live Record" })).toBeInTheDocument();
		expect(document.title).toBe("Live Record | Maschina");
	});

	it("says it is reading before the record arrives", () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => new Promise(() => {})),
		);
		render(<LiveApp />);

		expect(screen.getByText(/reading the record/i)).toBeInTheDocument();
	});

	it("shows a real trade with a link to the transaction on Solana", async () => {
		show({ live: [live], paper: [], refused: [] });

		const proof = await screen.findByRole("link", { name: "Solscan" });
		expect(proof).toHaveAttribute("href", `https://solscan.io/tx/${live.signature}`);
		expect(proof).toHaveAttribute("rel", expect.stringContaining("noopener"));
	});

	it("reads the amounts as people write them, not as base units", async () => {
		show({ live: [live], paper: [], refused: [] });

		const real = await screen.findByRole("table", { name: /real money/i });
		// 40350000 USDC base units is 40.35, and 340000000 lamports is 0.34 SOL, at 118.68 each.
		expect(within(real).getByText("40.35")).toBeInTheDocument();
		expect(within(real).getByText("0.34")).toBeInTheDocument();
		expect(within(real).getByText("118.68")).toBeInTheDocument();
	});

	it("keeps paper in its own table, and gives it no link to anything", async () => {
		show({ live: [live], paper: [onPaper], refused: [] });

		const paper = await screen.findByRole("table", { name: /on paper/i });
		expect(within(paper).queryByRole("link")).toBeNull();
		expect(within(paper).queryByText("Solscan")).toBeNull();
		expect(within(paper).getByText("24.36")).toBeInTheDocument();
	});

	it("never puts a paper trade in the real money table", async () => {
		show({ live: [live], paper: [onPaper], refused: [] });

		const real = await screen.findByRole("table", { name: /real money/i });
		// The paper trade's amount must not appear among the real ones.
		expect(within(real).queryByText("24.36")).toBeNull();
	});

	it("says plainly when there is nothing on either side yet", async () => {
		show({ live: [], paper: [], refused: [] });

		expect(await screen.findByText(/no finished trades with real money yet/i)).toBeInTheDocument();
		expect(screen.getByText(/no paper trades yet/i)).toBeInTheDocument();
	});

	it("says it could not be read, rather than showing an empty record as if it were true", async () => {
		// An empty page and a broken page look the same, and one of them is a lie about the machines.
		show({}, 502);

		expect(await screen.findByRole("alert")).toHaveTextContent(/could not be read/i);
		expect(screen.queryByRole("table")).toBeNull();
	});

	it("refuses an answer that puts a signature on a paper trade", async () => {
		// Nothing may present a paper trade as real, so a malformed answer is a failure, not a page.
		show({ live: [], paper: [live], refused: [] });

		expect(await screen.findByRole("alert")).toBeInTheDocument();
	});

	it("says what the record is, and what it is not", async () => {
		show({ live: [], paper: [], refused: [] });

		expect(screen.getByText(/not, by itself, proof/i)).toBeInTheDocument();
		expect(screen.getByText(/has not had an independent security audit/i)).toBeInTheDocument();
	});

	it("asks again on its own, so a page left open stays current", async () => {
		vi.useFakeTimers();
		const call = answering({ live: [], paper: [] });
		vi.stubGlobal("fetch", call);
		render(<LiveApp />);

		// Fake timers throughout: `waitFor` runs on real ones and the two do not mix.
		await vi.advanceTimersByTimeAsync(0);
		expect(call).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(30_000);
		expect(call).toHaveBeenCalledTimes(2);
	});

	it("shows what the machines were stopped from doing, which is the point of the record", async () => {
		show({ live: [], paper: [], refused: [stopped] });

		const section = await screen.findByRole("region", { name: "Refused" });
		expect(within(section).getByText("Buy")).toBeInTheDocument();
		// The amount it wanted, so a reader can see the size of what was stopped.
		expect(within(section).getByText("500")).toBeInTheDocument();
		expect(within(section).getByText("4.2")).toBeInTheDocument();
	});

	it("says which gate refused it and under which rule, in words", async () => {
		show({ live: [], paper: [], refused: [stopped] });

		const section = await screen.findByRole("region", { name: "Refused" });
		expect(within(section).getByText("over the budget it was given")).toBeInTheDocument();
		expect(within(section).getByText("Maschina's rules")).toBeInTheDocument();
	});

	it("names the wallet provider as the one that refused, when it was", async () => {
		show({
			live: [],
			paper: [],
			refused: [{ ...stopped, by: "provider", rule: "provider_policy" }],
		});

		const section = await screen.findByRole("region", { name: "Refused" });
		expect(within(section).getByText("the wallet provider")).toBeInTheDocument();
	});

	it("never links a refusal to the chain, because nothing reached it", async () => {
		show({ live: [], paper: [], refused: [stopped] });

		const section = await screen.findByRole("region", { name: "Refused" });
		expect(within(section).queryByRole("link")).toBeNull();
	});

	it("says so plainly when nothing has been refused", async () => {
		show({ live: [live], paper: [], refused: [] });

		const section = await screen.findByRole("region", { name: "Refused" });
		expect(within(section).getByText(/nothing has been refused/i)).toBeInTheDocument();
	});
});
