import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveRecord } from "./live-record.tsx";

const SIGNATURE_A = `${"A".repeat(87)}1`;
const SIGNATURE_B = `${"B".repeat(87)}2`;

const trades = [
	{
		at: "2026-10-08T18:49:04.000Z",
		side: "sell",
		usdc: "24360000",
		sol: "196600000",
		signature: SIGNATURE_A,
	},
	{
		at: "2026-10-08T14:46:04.000Z",
		side: "buy",
		usdc: "24000000",
		sol: "196600000",
		signature: SIGNATURE_B,
	},
];

const answer = (body: unknown, ok = true) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));

afterEach(() => vi.unstubAllGlobals());

const section = () => screen.getByRole("region", { name: "Live record" });

describe("the live record", () => {
	it("has a centered pearl headline with the thin outline, like the others, and one gray line under it", async () => {
		vi.stubGlobal("fetch", answer({ trades }));
		render(<LiveRecord />);
		const heading = within(section()).getByRole("heading", {
			level: 2,
			name: "Every trade, on the record.",
		});
		for (const part of [
			"text-center",
			"bg-clip-text",
			"[-webkit-text-stroke:1px_oklch(1_0_0/0.4)]",
			"pb-[0.14em]",
			"-mb-[0.14em]",
		])
			expect(heading.className).toContain(part);
		expect(
			screen.getByText("Real trades on Solana, newest first. Each one links to its transaction."),
		).toHaveClass("text-neutral-400");
		await screen.findAllByRole("listitem");
	});

	it("reads the public record from the API, once, with no sign in", async () => {
		const get = answer({ trades });
		vi.stubGlobal("fetch", get);
		render(<LiveRecord />);
		await screen.findAllByRole("listitem");
		expect(get).toHaveBeenCalledTimes(1);
		const [url, options] = get.mock.calls[0] as unknown as [string, RequestInit | undefined];
		expect(url).toBe("https://api.maschina.dev/v1/public/record");
		expect(options?.credentials).not.toBe("include");
	});

	it("lists each trade newest first: when (in UTC), which way, what it was for, and a link to its transaction", async () => {
		vi.stubGlobal("fetch", answer({ trades }));
		render(<LiveRecord />);
		const rows = await screen.findAllByRole("listitem");
		expect(rows).toHaveLength(2);
		expect(rows[0]).toHaveTextContent("Oct 8, 18:49 UTC");
		expect(rows[0]).toHaveTextContent("Sold");
		expect(rows[0]).toHaveTextContent("0.1966 SOL for 24.36 USDC");
		expect(rows[1]).toHaveTextContent("Bought");
		expect(rows[1]).toHaveTextContent("0.1966 SOL for 24.00 USDC");
		const link = within(rows[0] as HTMLElement).getByRole("link", { name: /Solscan/ });
		expect(link).toHaveAttribute("href", `https://solscan.io/tx/${SIGNATURE_A}`);
		expect(link).toHaveAttribute("target", "_blank");
		expect(link.getAttribute("rel")).toContain("noopener");
		expect(link.getAttribute("rel")).toContain("noreferrer");
	});

	it("shows at most the latest eight, and ignores anything the API sends that is not a real trade", async () => {
		const many = Array.from({ length: 12 }, (_, i) => ({
			...trades[0],
			at: `2026-10-08T${String(10 + (i % 10)).padStart(2, "0")}:00:00.000Z`,
			signature: `${i}`.repeat(88).slice(0, 88),
		}));
		vi.stubGlobal(
			"fetch",
			answer({ trades: [...many, { at: "nope" }, null, { ...trades[0], side: "hold" }] }),
		);
		render(<LiveRecord />);
		expect(await screen.findAllByRole("listitem")).toHaveLength(8);
	});

	it("says plainly when there is nothing to show yet, and when it could not be loaded, and never invents a trade", async () => {
		vi.stubGlobal("fetch", answer({ trades: [] }));
		const first = render(<LiveRecord />);
		expect(await screen.findByText("No trades to show yet.")).toBeInTheDocument();
		first.unmount();

		vi.stubGlobal("fetch", answer({}, false));
		render(<LiveRecord />);
		expect(
			await screen.findByText("The record could not be loaded right now."),
		).toBeInTheDocument();
		expect(screen.queryAllByRole("listitem")).toHaveLength(0);
	});

	it("survives the network failing outright", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Promise.reject(new Error("offline"))),
		);
		render(<LiveRecord />);
		await waitFor(() =>
			expect(screen.getByText("The record could not be loaded right now.")).toBeInTheDocument(),
		);
	});

	it("claims nothing about results: no profit, returns, wins or totals", async () => {
		vi.stubGlobal("fetch", answer({ trades }));
		render(<LiveRecord />);
		await screen.findAllByRole("listitem");
		expect(section().textContent ?? "").not.toMatch(/profit|return|win|gain|earn|total|%/i);
	});

	it("is square and still, on black between the page margins", async () => {
		vi.stubGlobal("fetch", answer({ trades }));
		const { container } = render(<LiveRecord />);
		await screen.findAllByRole("listitem");
		expect(section().className).toContain("bg-black");
		expect(section().className).toContain("px-(--gutter)");
		expect(container.innerHTML).not.toMatch(/rounded|animate-|<canvas|<img/);
	});
});
