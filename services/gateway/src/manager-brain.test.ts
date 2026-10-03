import { describe, expect, it, vi } from "vitest";
import { brainTools, compactToken, SYSTEM } from "./manager-brain.ts";

const token = {
	mint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
	symbol: "PUMP",
	name: "Pump",
	decimals: 6,
	priceUsd: 0.0054,
	liquidityUsd: 40_327_119.77,
	marketCapUsd: 2_538_573_333.96,
	holders: 292_292,
	organicScore: 98.5,
	ageHours: 24.04,
	verified: true,
	mintable: false,
	freezable: undefined,
	topHoldersPct: 31.23,
	m5: { priceChangePct: -0.104, volumeUsd: 55_628.4, buys: 211, sells: 252, traders: 127 },
	h1: {
		priceChangePct: 0.661,
		volumeUsd: 991_865.8,
		buys: undefined,
		sells: undefined,
		traders: undefined,
	},
	foundBy: ["trending"],
};

const ports = {
	machines: vi.fn(async () => [{ name: "Range Finder" }]),
	record: vi.fn(async (id: string) => (id === "mine" ? [{ type: "trade.completed" }] : undefined)),
	scan: vi.fn(async () => [token]),
};
const tool = (name: string) => {
	const found = brainTools(ports).find((each) => each.name === name);
	if (!found) throw new Error(name);
	return found;
};

describe("what the manager can look at", () => {
	it("only looks: no tool can trade, move money or change a machine", () => {
		expect(brainTools(ports).map((each) => each.name)).toEqual([
			"list_machines",
			"machine_record",
			"scan_market",
		]);
		expect(SYSTEM).toContain("cannot trade, move money, or change a machine");
	});

	it("lists the owner's machines", async () => {
		expect(await tool("list_machines").run({})).toEqual([{ name: "Range Finder" }]);
	});

	it("reads a machine's record, and says so when it is not theirs", async () => {
		expect(await tool("machine_record").run({ machineId: "mine" })).toEqual([
			{ type: "trade.completed" },
		]);
		await expect(tool("machine_record").run({ machineId: "someone else's" })).rejects.toThrow(
			"no machine of theirs",
		);
		await expect(tool("machine_record").run({})).rejects.toThrow();
	});

	it("scans the market within sensible bounds", async () => {
		await tool("scan_market").run({ interval: "5m", limit: 1000 });
		expect(ports.scan).toHaveBeenLastCalledWith({ interval: "5m", limit: 100 });
		await tool("scan_market").run({ interval: "forever" });
		expect(ports.scan).toHaveBeenLastCalledWith({ interval: "1h", limit: 30 });
	});
});

describe("a token as the manager reads it", () => {
	it("keeps the figures that matter, rounded, with unknowns as null", () => {
		expect(compactToken(token)).toEqual({
			symbol: "PUMP",
			mint: token.mint,
			priceUsd: 0.0054,
			liquidityUsd: 40_327_120,
			marketCapUsd: 2_538_573_334,
			holders: 292_292,
			ageHours: 24,
			organic: 99,
			verified: true,
			canMintMore: false,
			canFreeze: null,
			topHoldersPct: 31.2,
			change5mPct: -0.1,
			change1hPct: 0.66,
			volume5mUsd: 55_628,
			volume1hUsd: 991_866,
			buysSells5m: "211/252",
			foundBy: ["trending"],
		});
		expect(compactToken({ ...token, m5: { ...token.m5, buys: undefined } }).buysSells5m).toBeNull();
	});
});
