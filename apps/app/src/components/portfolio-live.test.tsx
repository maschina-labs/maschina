import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Everything the portfolio reads, as the signed in owner's machines and their records.
const state = vi.hoisted(() => ({
	signedIn: true,
	machines: undefined as unknown[] | undefined,
	records: [] as unknown[][],
}));

vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({ options: { context: { api: {} } } }),
}));
vi.mock("@tanstack/react-query", async (real) => ({
	...(await real<object>()),
	useQueries: () => state.records.map((data) => ({ data })),
}));
vi.mock("../lib/session.ts", () => ({
	useSession: () => ({ data: state.signedIn ? { ownerId: "o", walletAddress: "w" } : undefined }),
}));
vi.mock("../lib/machines.ts", async (real) => ({
	...(await real<object>()),
	useMachines: () => ({ data: state.machines }),
}));
vi.mock("./pnl-chart.tsx", () => ({ PnlChartView: () => <div>PNL CHART</div> }));

const portfolio = await import("./portfolio.tsx");

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const summary = (machineId: string, name: string) => ({
	machineId,
	name,
	kind: "range",
	walletAddress: "w",
	createdAt: "2026-09-28T05:00:00Z",
	state: "running",
	budget: { granted: "40000000", reserved: "0", settled: "0", available: "40000000" },
	result: {
		realised: "1000000",
		position: "0",
		basis: "0",
		feesLamports: "0",
		trades: 2,
		roundTrips: 1,
		wins: 1,
		losses: 0,
		simulated: false,
	},
});
const buy = (id: string, at: string) => [
	{
		id: `${id}c`,
		type: "trade.completed",
		occurredAt: at,
		payload: { tradeId: id, inputAmount: "40000000", outputAmount: "333000000", signature: "s" },
	},
	{
		id: `${id}i`,
		type: "trade.intended",
		occurredAt: at,
		payload: { tradeId: id, inputMint: USDC, outputMint: SOL, inputAmount: "40000000" },
	},
];

beforeEach(() => {
	state.signedIn = true;
	state.machines = [summary("a", "Range Finder"), summary("b", "Dip Buyer")];
	state.records = [
		[
			{
				id: "r1",
				type: "run.skipped",
				occurredAt: "2026-09-28T07:00:00Z",
				payload: { detail: "x: busy" },
			},
			...buy("t1", "2026-09-28T06:22:00Z"),
		],
		[{ id: "s1", type: "machine.started", occurredAt: "2026-09-27T05:00:00Z", payload: {} }],
	];
});

describe("the portfolio, signed in", () => {
	it("feeds every machine's record into one activity list, newest first", () => {
		const { result } = renderHook(() => portfolio.useActivity());
		expect(result.current[0]?.type).toBe("run.skipped");
		expect(result.current.map((entry) => entry.machineName)).toContain("Dip Buyer");
	});

	it("lists the trades its machines made, by machine", () => {
		const { result } = renderHook(() => portfolio.useMachineTrades());
		expect(result.current).toHaveLength(1);
		expect(result.current[0]?.machine).toBe("RANGE FINDER");
	});

	it("ranks its machines over a window", () => {
		const { result } = renderHook(() => portfolio.useStandings());
		expect(result.current("ALL")).toHaveLength(2);
	});

	it("pairs each machine with its record for the operating picture", () => {
		const { result } = renderHook(() => portfolio.useOperatingPicture());
		expect(result.current.map((each) => each.machine.name)).toEqual(["Range Finder", "Dip Buyer"]);
	});
});

describe("the portfolio, before anything is known", () => {
	it("shows nothing of anyone when nobody is signed in", () => {
		state.signedIn = false;
		expect(renderHook(() => portfolio.useActivity()).result.current).toEqual([]);
		expect(renderHook(() => portfolio.useMachineTrades()).result.current).toEqual([]);
		expect(renderHook(() => portfolio.useStandings()).result.current("ALL")).toEqual([]);
		expect(renderHook(() => portfolio.useOperatingPicture()).result.current).toEqual([]);
	});
});
