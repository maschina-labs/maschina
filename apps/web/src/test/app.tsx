import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { createApi } from "../lib/api.ts";
import { createQueryClient } from "../lib/query.ts";
import { createAppRouter } from "../router.tsx";

/**
 * The whole app at an address, against a stand-in API that answers from the fixtures below. Signed in
 * or out, with machines or none. Everything outside Maschina (prices, weather, the world map, the
 * market's streams) answers nothing, as it would offline, so no test waits on the internet.
 */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const OWNER = "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR";
export const MACHINE_ID = "01a0e674-dbbf-75e0-a420-97aa2b709449";

const result = {
	realised: "1100000",
	position: "0",
	basis: "0",
	feesLamports: "15000",
	trades: 2,
	roundTrips: 1,
	wins: 1,
	losses: 0,
	simulated: false,
};

export const machine = {
	machineId: MACHINE_ID,
	name: "Range Finder",
	kind: "following_range",
	walletAddress: "6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXaHy",
	createdAt: "2026-10-01T08:00:00.000Z",
	paper: false,
	state: "running",
	budget: { granted: "40000000", reserved: "0", settled: "0", available: "40000000" },
	result,
};

const detail = {
	...machine,
	settings: {
		quoteMint: USDC,
		baseMint: SOL,
		bandBps: 250,
		floorBps: 800,
		amountPerBuy: "39000000",
		slippageBps: 50,
	},
	limits: { maxPerTrade: "39000000", maxPerDay: "40000000", approvedMints: [USDC, SOL] },
	actions: ["pause", "stop"],
};

const at = (minutes: number) =>
	new Date(Date.parse("2026-10-02T10:00:00Z") + minutes * 60_000).toISOString();
let n = 0;
const event = (type: string, minutes: number, payload: Record<string, unknown> = {}) => ({
	id: `e${++n}`,
	type,
	occurredAt: at(minutes),
	payload,
});

/** A day in the machine's life, newest first as the API sends it. */
const record = [
	event("withdrawal.completed", 90, { mint: USDC, amount: "1000000" }),
	event("sweep.completed", 80, { mint: USDC, amount: "1100000" }),
	event("trade.completed", 70, {
		tradeId: "t2",
		signature: "5sigTwoxRealLookingButMadeUpForTheTestsOnly",
		inputAmount: "330000000",
		outputAmount: "41000000",
	}),
	event("trade.intended", 69, { tradeId: "t2", inputMint: SOL, outputMint: USDC }),
	event("trade.refused", 50, { reason: "today's spending would pass the daily cap" }),
	event("run.skipped", 40, { reason: "the price is inside its band" }),
	event("trade.completed", 30, {
		tradeId: "t1",
		inputAmount: "39000000",
		outputAmount: "330000000",
	}),
	event("trade.intended", 29, { tradeId: "t1", inputMint: USDC, outputMint: SOL }),
	event("machine.started", 1),
	event("machine.created", 0),
];

const balances = {
	wallet: {
		address: machine.walletAddress,
		lamports: "12000000",
		tokens: [{ mint: USDC, amount: "40000000", decimals: 6 }],
	},
	vault: {
		address: "6JTAb5",
		lamports: "0",
		tokens: [{ mint: USDC, amount: "1100000", decimals: 6 }],
	},
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A paper trader part way through a run: one holding, one of each kind of log line. */
export const TRADER_RUN = {
	id: "r1",
	mode: "paper",
	status: "running" as "running" | "paused" | "stopped",
	pausedBecause: undefined as string | undefined,
	startedAt: "2026-10-03T12:00:00.000Z",
	startingCash: "40.00",
	cash: "29.99",
	worth: "40.82",
	realized: "0.31",
	fees: "0.01",
	trades: 3,
	holdings: [
		{
			symbol: "WIF",
			mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
			cost: "10.00",
			worth: "10.52",
		},
		{
			symbol: "NEW",
			mint: "New1111111111111111111111111111111111111111",
			cost: "5.00",
			worth: null as string | null,
		},
	],
	thinking: { spentUsd: 0.12, turns: 4, lastAt: "2026-10-03T12:04:00.000Z" },
	log: [
		{
			at: "2026-10-03T12:04:00.000Z",
			kind: "think",
			text: "Holding WIF.",
			costUsd: 0.031 as number | undefined,
		},
		{
			at: "2026-10-03T12:03:00.000Z",
			kind: "refused",
			text: "Did not buy THIN: the trade would move the price 5%",
			costUsd: undefined,
		},
	],
};

/** The news, the same for everyone, signed in or not. */
const NEWS = {
	fetchedAt: "2026-10-03T12:00:00.000Z",
	items: [
		{
			id: "https://solana.com/news/open-usd",
			title: "Open USD Is Live on Solana",
			link: "https://solana.com/news/open-usd",
			source: "Solana",
			publishedAt: "2026-10-03T11:00:00.000Z",
			summary: "A dollar that settles in seconds.",
			image: "https://solana.com/uploads/hero.webp",
			solana: true,
		},
		{
			id: "https://decrypt.co/1",
			title: "Crypto job postings triple",
			link: "https://decrypt.co/1",
			source: "Decrypt",
			publishedAt: "2026-10-03T10:00:00.000Z",
			image: "https://img.decrypt.co/1.png",
			solana: false,
		},
		{
			id: "https://www.helius.dev/blog/agave",
			title: "Agave 4.3: all you need to know",
			link: "https://www.helius.dev/blog/agave",
			source: "Helius",
			publishedAt: "2026-10-02T10:00:00.000Z",
			solana: true,
		},
	],
};

/** Answers the API as a signed in owner with one machine at work, or as nobody. */
export function standIn({
	signedIn = true,
	machines = [machine],
	halt,
	aiKey,
	trader,
}: {
	signedIn?: boolean;
	machines?: (typeof machine)[];
	/** The stop switch, on with this reason, or off when left out. */
	halt?: string;
	/** The last four of an AI key already set, or none set when left out. */
	aiKey?: string;
	/** A paper trader run already going, or none when left out. */
	trader?: typeof TRADER_RUN;
} = {}) {
	let keyHint = aiKey;
	let traderRun: typeof TRADER_RUN | null = trader ?? null;
	const requests: { method: string; path: string; body?: unknown }[] = [];
	const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		// Read the request without ever building a Request from the app's own: its abort signal belongs to
		// the test browser, and Node's fetch rejects it when a test ends mid-request.
		const href = input instanceof Request ? input.url : String(input);
		const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
		const raw =
			input instanceof Request
				? await input
						.clone()
						.text()
						.catch(() => "")
				: init?.body;
		// Relative, as the globe asks for its map, means the app's own address.
		const url = new URL(href, "http://localhost:3000");
		let body: unknown;
		if (method !== "GET" && typeof raw === "string" && raw) {
			try {
				body = JSON.parse(raw);
			} catch {
				body = undefined;
			}
		}
		const request = { method };
		requests.push({ method: request.method, path: url.pathname, body });
		if (url.host !== "localhost:4000") return new Response("offline", { status: 503 });
		if (url.pathname === "/v1/status")
			return json({
				status: "ok",
				service: "gateway",
				version: "test",
				time: "2026-10-02T21:00:00.000Z",
				...(halt ? { halt: { reason: halt, since: "2026-10-02T20:55:00.000Z" } } : {}),
			});
		if (url.pathname === "/v1/news") return json(NEWS);
		if (url.pathname === "/v1/auth/me")
			return signedIn
				? json({ ownerId: "o", walletAddress: OWNER })
				: json({ error: "signed out" }, 401);
		if (!signedIn) return json({ error: "signed out" }, 401);
		if (url.pathname === "/v1/machines" && request.method === "GET") return json({ machines });
		const one = /^\/v1\/machines\/([^/]+)(\/[a-z]+)?$/.exec(url.pathname);
		const found = machines.find((each) => each.machineId === one?.[1]);
		if (one && !found) return json({ error: "not found" }, 404);
		if (one && found) {
			const part = one[2];
			if (!part) return json({ ...detail, ...found });
			if (part === "/record") return json({ events: record });
			if (part === "/balances") return json(balances);
			if (part === "/actions") return json({ state: "paused" });
			if (part === "/recipe") return json({ definitionId: "d".repeat(64) });
		}
		if (url.pathname === "/v1/manager/trader/stop") {
			if (traderRun) traderRun = { ...traderRun, status: "stopped" };
			return json({ run: traderRun });
		}
		if (url.pathname === "/v1/manager/trader") {
			if (request.method === "POST") {
				const cash = (body as { cashUsd?: number } | undefined)?.cashUsd ?? 0;
				traderRun = {
					...TRADER_RUN,
					startingCash: cash.toFixed(2),
					cash: cash.toFixed(2),
					worth: cash.toFixed(2),
				};
			}
			return json({ run: traderRun });
		}
		if (url.pathname === "/v1/manager/messages") {
			if (!keyHint)
				return json({ error: { message: "add your Anthropic key in settings first" } }, 409);
			const said = (body as { messages?: { text: string }[] } | undefined)?.messages ?? [];
			if (said.at(-1)?.text.includes("broke"))
				return json({ error: { message: "Your Anthropic credit has run out" } }, 429);
			return json({
				reply: `You asked: ${said.at(-1)?.text}`,
				costUsd: 0.0123,
				looked: [{ tool: "list_machines", ok: true }],
			});
		}
		if (url.pathname === "/v1/manager/key") {
			if (request.method === "PUT") {
				const key = (body as { key?: string } | undefined)?.key ?? "";
				if (key.includes("refused"))
					return json({ error: { message: "Anthropic did not accept that key" } }, 400);
				keyHint = key.slice(-4);
			}
			if (request.method === "DELETE") keyHint = undefined;
			return json(keyHint ? { set: true, hint: keyHint } : { set: false });
		}
		if (url.pathname === "/v1/machines" && request.method === "POST")
			return json({ machineId: "new", walletAddress: machine.walletAddress }, 201);
		return json({ error: "no stand-in for this" }, 404);
	});
	vi.stubGlobal("fetch", fetcher);
	return { requests };
}

export function renderAt(path: string) {
	const queryClient = createQueryClient();
	const router = createAppRouter({
		api: createApi("http://localhost:4000"),
		queryClient,
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	return {
		router,
		...render(
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>,
		),
	};
}
