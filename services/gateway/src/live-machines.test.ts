import { describe, expect, it } from "vitest";
import { mayRunOnRealMoney, whoMayRunOnRealMoney } from "./live-machines.ts";

const ASH = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const STRANGER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

describe("who may put real money in", () => {
	it("is nobody, when nothing is configured", () => {
		expect(whoMayRunOnRealMoney(undefined)).toEqual([]);
		expect(whoMayRunOnRealMoney("")).toEqual([]);
		expect(whoMayRunOnRealMoney("   ")).toEqual([]);
	});

	it("is the wallets named, with the spaces and empty entries a hand-edited list collects", () => {
		expect(whoMayRunOnRealMoney(` ${ASH} , ,${STRANGER}, `)).toEqual([ASH, STRANGER]);
	});
});

describe("whether a machine may be made with real money", () => {
	it("lets anybody make a paper machine, including when nobody may use real money", () => {
		expect(mayRunOnRealMoney({ paper: true, ownerWallet: STRANGER, allowed: [] })).toBe(true);
	});

	it("refuses real money to everybody when the list is empty, which is the default", () => {
		expect(mayRunOnRealMoney({ paper: false, ownerWallet: ASH, allowed: [] })).toBe(false);
	});

	it("allows real money only to a wallet on the list", () => {
		expect(mayRunOnRealMoney({ paper: false, ownerWallet: ASH, allowed: [ASH] })).toBe(true);
		expect(mayRunOnRealMoney({ paper: false, ownerWallet: STRANGER, allowed: [ASH] })).toBe(false);
	});

	it("compares the whole address exactly: no prefix, no case folding, no trimming of the caller's value", () => {
		expect(mayRunOnRealMoney({ paper: false, ownerWallet: ASH.slice(0, 20), allowed: [ASH] })).toBe(
			false,
		);
		expect(
			mayRunOnRealMoney({ paper: false, ownerWallet: ASH.toLowerCase(), allowed: [ASH] }),
		).toBe(false);
		expect(mayRunOnRealMoney({ paper: false, ownerWallet: ` ${ASH}`, allowed: [ASH] })).toBe(false);
	});

	it("refuses an owner with no wallet rather than matching an empty entry", () => {
		expect(mayRunOnRealMoney({ paper: false, ownerWallet: "", allowed: [""] })).toBe(false);
	});
});
