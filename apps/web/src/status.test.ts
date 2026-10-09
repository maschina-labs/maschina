import { describe, expect, it, vi } from "vitest";
import { readStatus } from "./status.ts";

const answer = (body: unknown, status = 200) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("reading whether Maschina is up", () => {
	it("asks the API's own status check", async () => {
		const fetch = answer({ status: "ok" });
		await readStatus("https://api.test", fetch);
		expect(fetch).toHaveBeenCalledWith("https://api.test/v1/status", expect.anything());
	});

	it("is up when the API says so", async () => {
		expect(await readStatus("https://api.test", answer({ status: "ok" }))).toEqual({ state: "up" });
	});

	it("is paused when the stop switch is on, and says why", async () => {
		const body = {
			status: "ok",
			halt: { reason: "upgrading the signer", since: "2026-10-09T00:00:00Z" },
		};
		expect(await readStatus("https://api.test", answer(body))).toEqual({
			state: "paused",
			reason: "upgrading the signer",
		});
	});

	it("is down when the API answers with an error", async () => {
		expect(await readStatus("https://api.test", answer({}, 503))).toEqual({ state: "down" });
	});

	it("is down when the API cannot be reached at all", async () => {
		const fetch = vi.fn(async () => {
			throw new TypeError("network");
		});
		expect(await readStatus("https://api.test", fetch)).toEqual({ state: "down" });
	});

	it("reports a send before the request goes out, and a receive when any answer comes back", async () => {
		const seen: string[] = [];
		const fetch = vi.fn(async () => {
			seen.push("request");
			return new Response("{}", { status: 503 });
		});
		await readStatus("https://api.test", fetch, {
			onSend: () => seen.push("tx"),
			onReceive: () => seen.push("rx"),
		});
		// Even an error answer is a receive: something came back over the wire.
		expect(seen).toEqual(["tx", "request", "rx"]);
	});

	it("reports no receive when nothing comes back", async () => {
		const seen: string[] = [];
		const fetch = vi.fn(async () => {
			throw new TypeError("network");
		});
		await readStatus("https://api.test", fetch, {
			onSend: () => seen.push("tx"),
			onReceive: () => seen.push("rx"),
		});
		expect(seen).toEqual(["tx"]);
	});
});
