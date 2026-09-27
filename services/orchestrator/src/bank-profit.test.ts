import type { SweepRequest, SweepResponse } from "@maschina/contracts";
import { newId } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { type BankProfitPorts, bankProfit, sweepOnce } from "./bank-profit.ts";

const A = newId<"machine">();
const B = newId<"machine">();
const OPEN = newId<"sweep">();

function ports(overrides: Partial<BankProfitPorts> = {}) {
	const asked: SweepRequest[] = [];
	const logged: { level: string; message: string }[] = [];
	const log = (level: string) => (_fields: unknown, message?: string) => {
		logged.push({ level, message: message ?? "" });
	};
	const base: BankProfitPorts = {
		candidates: async () => [{ machineId: A }, { machineId: B }],
		sweep: async (request): Promise<SweepResponse> => {
			asked.push(request);
			return { status: "not_due", sweepId: request.sweepId, because: "below its float" };
		},
		logger: { debug: log("debug"), info: log("info"), warn: log("warn"), error: log("error") },
		...overrides,
	};
	return { ports: base, asked, logged };
}

describe("one look for profit to bank", () => {
	it("asks the signer about every machine that could be swept, and decides nothing itself", async () => {
		const { ports: p, asked } = ports();
		await sweepOnce(p);

		expect(asked.map((request) => request.machineId)).toEqual([A, B]);
	});

	it("gives every new question its own id, so two sweeps are never mistaken for one", async () => {
		const { ports: p, asked } = ports();
		await sweepOnce(p);

		expect(asked[0]?.sweepId).not.toBe(asked[1]?.sweepId);
	});

	it("asks about an open sweep by its own id, so it is finished rather than decided again", async () => {
		const { ports: p, asked } = ports({
			candidates: async () => [{ machineId: A, openSweepId: OPEN }],
		});
		await sweepOnce(p);

		expect(asked).toEqual([{ machineId: A, sweepId: OPEN }]);
	});

	it("says so when profit is banked, and says nothing above debug when nothing is due", async () => {
		const { ports: p, logged } = ports({
			sweep: async (request) =>
				request.machineId === A
					? {
							status: "swept",
							sweepId: request.sweepId,
							signature: "5".repeat(88),
							to: "CzjvJfCTedyrVaebP9Vbn1BjJMKPqtdDjSfbWUDiFnLt",
							mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
							amount: "1500000",
						}
					: { status: "not_due", sweepId: request.sweepId, because: "holding a position" },
		});
		await sweepOnce(p);

		expect(logged.filter((entry) => entry.level === "info")).toHaveLength(1);
		expect(logged.find((entry) => entry.level === "debug")?.message).toMatch(/nothing to bank/);
	});

	it("warns about a refusal", async () => {
		const { ports: p, logged } = ports({
			sweep: async (request) => ({
				status: "refused",
				sweepId: request.sweepId,
				rule: "bad_transaction",
				reason: "the sweep pays into an account that is not the vault's",
			}),
		});
		await sweepOnce(p);

		expect(logged.filter((entry) => entry.level === "warn")).toHaveLength(2);
	});

	it("keeps going when one machine's sweep throws", async () => {
		const { ports: p, asked } = ports({
			sweep: async (request) => {
				asked.push(request);
				if (request.machineId === A) throw new Error("the signer could not be reached");
				return { status: "not_due", sweepId: request.sweepId, because: "below its float" };
			},
		});
		await sweepOnce(p);

		expect(asked.map((request) => request.machineId)).toEqual([A, B]);
	});
});

describe("looking again and again", () => {
	it("looks, waits, and stops when told to", async () => {
		const stop = new AbortController();
		let looks = 0;
		const { ports: p } = ports({
			candidates: async () => {
				looks += 1;
				return [];
			},
			sleep: async () => {
				if (looks >= 3) stop.abort();
			},
		});

		await bankProfit(p, stop.signal);
		expect(looks).toBe(3);
	});

	it("keeps looking when the list of machines cannot be read", async () => {
		const stop = new AbortController();
		let tries = 0;
		const { ports: p, logged } = ports({
			candidates: async () => {
				tries += 1;
				throw new Error("the database went away");
			},
			sleep: async () => {
				if (tries >= 2) stop.abort();
			},
		});

		await bankProfit(p, stop.signal);
		expect(tries).toBe(2);
		expect(logged.some((entry) => entry.level === "warn")).toBe(true);
	});

	it("waits longer than a transaction stays valid, so anything sent has landed or expired by the next look", async () => {
		const { DEFAULT_SWEEP_EVERY_MS } = await import("./bank-profit.ts");
		expect(DEFAULT_SWEEP_EVERY_MS).toBeGreaterThanOrEqual(3 * 60_000);
	});
});
