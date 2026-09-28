import { createLogger } from "@maschina/telemetry";
import { describe, expect, it, vi } from "vitest";
import { chatsFrom, telegramSender, tellForever, tellOnce } from "./alerts.ts";

const logger = createLogger({ service: "test", level: "silent" });
const owner = "01a0e5db-f605-7209-8006-f225cc7c3215";
const alert = (eventId: string, ownerId = owner) => ({
	eventId,
	ownerId,
	machineId: "m",
	machineName: "Range Finder",
	type: "machine.stopped",
	occurredAt: "2026-09-29T02:00:00.000Z",
});

/** An orchestrator that has these alerts pending, and remembers what was marked told. */
function orchestrator(pending: unknown[], markOk = true) {
	const marked: string[] = [];
	const asked: string[] = [];
	const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		const href = String(url);
		asked.push(href);
		if (href.includes("/pending")) return new Response(JSON.stringify({ alerts: pending }));
		marked.push(JSON.parse(String(init?.body)).eventId);
		return new Response("{}", { status: markOk ? 200 : 500 });
	}) as unknown as typeof fetch;
	return { fetcher, marked, asked };
}

const ports = (fetcher: typeof fetch, send = vi.fn(async () => undefined)) => ({
	orchestratorUrl: "http://orchestrator:4100",
	token: "b".repeat(40),
	chats: new Map([[owner, "12345"]]),
	send,
	fetcher,
	logger,
	since: new Date("2026-09-28T00:00:00Z"),
});

describe("telling owners", () => {
	it("sends each pending alert to its owner's chat, and marks it told", async () => {
		const { fetcher, marked, asked } = orchestrator([alert("a"), alert("b")]);
		const send = vi.fn(async () => undefined);

		expect(await tellOnce(ports(fetcher, send))).toBe(2);
		expect(send).toHaveBeenCalledWith("12345", "Range Finder stopped.");
		expect(marked).toEqual(["a", "b"]);
		expect(asked[0]).toContain(`owner=${owner}`);
		expect(asked[0]).toContain("channel=telegram");
	});

	it("leaves an alert it could not send unmarked, to try again", async () => {
		const { fetcher, marked } = orchestrator([alert("a")]);
		const send = vi.fn(async () => {
			throw new Error("Telegram is down");
		});

		expect(await tellOnce(ports(fetcher, send))).toBe(0);
		expect(marked).toEqual([]);
	});

	it("still counts an alert it sent but could not mark", async () => {
		const { fetcher } = orchestrator([alert("a")], false);
		expect(await tellOnce(ports(fetcher))).toBe(1);
	});

	it("tells nobody whose chat it does not know, and asks nothing with no chats", async () => {
		const { fetcher, marked } = orchestrator([alert("a", "someone-else")]);
		expect(await tellOnce(ports(fetcher))).toBe(0);
		expect(marked).toEqual([]);

		const quiet = orchestrator([]);
		expect(await tellOnce({ ...ports(quiet.fetcher), chats: new Map() })).toBe(0);
		expect(quiet.asked).toEqual([]);
	});

	it("says so when the orchestrator will not answer", async () => {
		const fetcher = vi.fn(async () => new Response("", { status: 401 })) as unknown as typeof fetch;
		await expect(tellOnce(ports(fetcher))).rejects.toThrow(/401/);
	});

	it("keeps looking after a bad look, until told to stop", async () => {
		const stop = new AbortController();
		const fetcher = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof fetch;
		let looks = 0;
		await tellForever({ ...ports(fetcher), everyMs: 1 }, stop.signal, async () => {
			looks += 1;
			if (looks === 2) stop.abort();
		});
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("logs how many it told on a good look", async () => {
		const stop = new AbortController();
		const { fetcher } = orchestrator([alert("a")]);
		await tellForever({ ...ports(fetcher), everyMs: 1 }, stop.signal, async () => stop.abort());
		expect(fetcher).toHaveBeenCalled();
	});
});

describe("Telegram", () => {
	it("sends a message to a chat through the bot", async () => {
		const fetcher = vi.fn(async () => new Response("{}")) as unknown as typeof fetch;
		await telegramSender("token-123", fetcher)("12345", "hello");
		expect(fetcher).toHaveBeenCalledWith(
			"https://api.telegram.org/bottoken-123/sendMessage",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("fails loudly when Telegram refuses", async () => {
		const fetcher = vi.fn(async () => new Response("", { status: 403 })) as unknown as typeof fetch;
		await expect(telegramSender("t", fetcher)("1", "x")).rejects.toThrow(/403/);
	});
});

describe("which chat belongs to which owner", () => {
	it("reads owner=chat pairs, ignoring anything half written", () => {
		expect([...chatsFrom(`${owner}=12345, bad, =9,x=`)]).toEqual([[owner, "12345"]]);
		expect(chatsFrom(undefined).size).toBe(0);
	});
});
