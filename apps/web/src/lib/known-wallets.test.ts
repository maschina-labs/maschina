import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { forgetWallet, rememberWallet, shortAddress, useKnownWallets } from "./known-wallets.ts";

const A = "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR";
const B = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";

beforeEach(() => localStorage.clear());

describe("the wallets this browser has used", () => {
	it("keeps the newest first, each once", () => {
		const { result } = renderHook(() => useKnownWallets());
		act(() => rememberWallet(A, new Date("2026-10-03T10:00:00Z")));
		act(() => rememberWallet(B, new Date("2026-10-03T11:00:00Z")));
		act(() => rememberWallet(A, new Date("2026-10-03T12:00:00Z")));
		expect(result.current.map((each) => each.address)).toEqual([A, B]);
		expect(result.current[0]?.lastUsed).toBe("2026-10-03T12:00:00.000Z");
	});

	it("keeps only the last six", () => {
		for (let i = 0; i < 8; i += 1) rememberWallet(`${A.slice(0, -1)}${i}`);
		expect(JSON.parse(localStorage.getItem("maschina.wallets") ?? "[]")).toHaveLength(6);
	});

	it("forgets one when asked", () => {
		const { result } = renderHook(() => useKnownWallets());
		act(() => rememberWallet(A));
		act(() => forgetWallet(A));
		expect(result.current).toEqual([]);
	});

	it("ignores anything stored that is not a wallet", () => {
		localStorage.setItem(
			"maschina.wallets",
			JSON.stringify([{ address: 1 }, "x", { address: A, lastUsed: "t" }]),
		);
		const { result } = renderHook(() => useKnownWallets());
		expect(result.current).toEqual([{ address: A, lastUsed: "t" }]);
		localStorage.setItem("maschina.wallets", "not json");
		window.dispatchEvent(new Event("maschina:wallets"));
	});

	it("shortens an address to its ends", () => {
		expect(shortAddress(A)).toBe("8GTg…etpR");
	});
});
