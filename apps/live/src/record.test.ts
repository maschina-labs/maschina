import { describe, expect, it, vi } from "vitest";
import { readRecord } from "./record.ts";

const trade = {
	at: "2026-10-11T12:00:00.000Z",
	side: "buy",
	usdc: "1000000",
	sol: "6000000",
	signature: "sig",
};
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("reading the public record", () => {
	it("asks the gateway's open route and gives back the trades", async () => {
		const call = vi.fn(async () => json({ trades: [trade] }));
		const result = await readRecord("https://api.maschina.dev", call as unknown as typeof fetch);
		expect(result).toEqual({ ok: true, trades: [trade] });
		expect(call).toHaveBeenCalledWith(
			"https://api.maschina.dev/v1/public/record",
			expect.anything(),
		);
	});

	it("says it could not be read when the network fails, the answer is an error, or it is not the record", async () => {
		const fails = async () => {
			throw new Error("offline");
		};
		expect((await readRecord("x", fails as unknown as typeof fetch)).ok).toBe(false);
		expect((await readRecord("x", (async () => json({}, 502)) as unknown as typeof fetch)).ok).toBe(
			false,
		);
		// A field that should never be public is refused rather than shown.
		const leaky = { trades: [{ ...trade, wallet: "secret" }] };
		expect((await readRecord("x", (async () => json(leaky)) as unknown as typeof fetch)).ok).toBe(
			false,
		);
	});
});
