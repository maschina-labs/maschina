import { describe, expect, it, vi } from "vitest";
import { readStatus } from "./status.ts";

const FEED = "https://status.maschina.dev/index.json";
const feed = (state: string, status = 200) =>
	vi.fn(
		async () =>
			new Response(JSON.stringify({ data: { attributes: { aggregate_state: state } } }), {
				status,
			}),
	);

describe("reading whether Maschina is up", () => {
	it("asks the status page's own feed, not the API", async () => {
		const get = feed("operational");
		await readStatus(FEED, get);
		expect(get).toHaveBeenCalledWith(FEED, expect.anything());
	});

	it("is up when every service is operational", async () => {
		expect(await readStatus(FEED, feed("operational"))).toEqual({ state: "up" });
	});

	it("is under maintenance when the status page says so", async () => {
		expect(await readStatus(FEED, feed("maintenance"))).toEqual({
			state: "paused",
			reason: "maintenance",
		});
	});

	it("is down for a degraded or down service, and for any state it does not know, rather than calling it fine", async () => {
		for (const state of ["downtime", "degraded", "something-new"])
			expect(await readStatus(FEED, feed(state)), state).toEqual({ state: "down" });
	});

	it("is still checking when the status page cannot be read: that says nothing about Maschina", async () => {
		expect(await readStatus(FEED, feed("operational", 503))).toEqual({ state: "checking" });
		expect(
			await readStatus(
				FEED,
				vi.fn(async () => new Response("<html>", { status: 200 })),
			),
		).toEqual({ state: "checking" });
		const offline = vi.fn(async () => {
			throw new TypeError("network");
		});
		expect(await readStatus(FEED, offline)).toEqual({ state: "checking" });
	});

	it("reports a send before the request goes out, and a receive when any answer comes back", async () => {
		const seen: string[] = [];
		const get = vi.fn(async () => {
			seen.push("request");
			return new Response("{}", { status: 503 });
		});
		await readStatus(FEED, get, {
			onSend: () => seen.push("tx"),
			onReceive: () => seen.push("rx"),
		});
		// Even an error answer is a receive: something came back over the wire.
		expect(seen).toEqual(["tx", "request", "rx"]);
	});

	it("reports no receive when nothing comes back", async () => {
		const seen: string[] = [];
		const get = vi.fn(async () => {
			throw new TypeError("network");
		});
		await readStatus(FEED, get, {
			onSend: () => seen.push("tx"),
			onReceive: () => seen.push("rx"),
		});
		expect(seen).toEqual(["tx"]);
	});
});
