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

export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOL = "So11111111111111111111111111111111111111112";
export const OWNER = "8GTgV1mscEjSoNmTdmNLaPjV1LTCRbRVHn7eh1UCetpR";
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

export const detail = {
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
export const record = [
	event("withdrawal.completed", 90, { mint: USDC, amount: "1000000" }),
	event("sweep.completed", 80, { mint: USDC, amount: "1100000" }),
	event("trade.completed", 70, {
		tradeId: "t2",
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

/** Answers the API as a signed in owner with one machine at work, or as nobody. */
export function standIn({
	signedIn = true,
	machines = [machine],
}: {
	signedIn?: boolean;
	machines?: (typeof machine)[];
} = {}) {
	const requests: { method: string; path: string; body?: unknown }[] = [];
	const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = input instanceof Request ? input : new Request(String(input), init);
		const url = new URL(request.url);
		const body =
			request.method === "GET"
				? undefined
				: await request
						.clone()
						.json()
						.catch(() => undefined);
		requests.push({ method: request.method, path: url.pathname, body });
		if (url.host !== "localhost:4000") return new Response("offline", { status: 503 });
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
		if (url.pathname === "/v1/machines" && request.method === "POST")
			return json({ machineId: "new", walletAddress: machine.walletAddress }, 201);
		return json({ error: "no stand-in for this" }, 404);
	});
	vi.stubGlobal("fetch", fetcher);
	return { requests };
}

/** No market streams in a test browser: a socket that opens nothing and says nothing. */
class QuietSocket {
	onmessage: ((event: MessageEvent) => void) | null = null;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	addEventListener() {}
	removeEventListener() {}
	close() {}
	send() {}
}
vi.stubGlobal("WebSocket", QuietSocket);

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
