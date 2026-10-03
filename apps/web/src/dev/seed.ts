/**
 * Made-up data for looking at the app on localhost: a signed in owner, a fleet of machines, weeks of
 * trades, alerts and a paper trader part way through a run, so every screen and chart has something in
 * it. `?seed=on` turns it on and it stays on in this browser; `?seed=off` turns it off.
 *
 * Only ever while developing: the built app never contains it (see main.tsx), and it answers the app
 * in the browser, so nothing reaches the gateway or the database.
 */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";
const OWNER = "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu";
const KEY = "maschina.seed";

/** The same numbers every time, so a screen looks the same each visit. */
function random(seed: number) {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

type Plan = {
	name: string;
	kind: string;
	paper: boolean;
	state: string;
	budget: number;
	trips: number;
	edge: number;
};

const PLANS: Plan[] = [
	{
		name: "Range Finder",
		kind: "following_range",
		paper: false,
		state: "running",
		budget: 40,
		trips: 26,
		edge: 0.012,
	},
	{
		name: "SOL Sniper",
		kind: "range",
		paper: false,
		state: "running",
		budget: 25,
		trips: 14,
		edge: 0.004,
	},
	{
		name: "Night Owl",
		kind: "range",
		paper: true,
		state: "running",
		budget: 100,
		trips: 38,
		edge: 0.009,
	},
	{
		name: "Dip Catcher",
		kind: "range",
		paper: true,
		state: "paused",
		budget: 60,
		trips: 11,
		edge: -0.006,
	},
	{
		name: "Old Range",
		kind: "range",
		paper: false,
		state: "stopped",
		budget: 0,
		trips: 6,
		edge: 0.002,
	},
];

const now = Date.now();
const DAY = 86_400_000;
let counter = 0;
const id = (prefix: string) => `${prefix}-${(++counter).toString().padStart(6, "0")}`;

function build(plan: Plan, index: number) {
	const next = random(index * 977 + 13);
	const machineId = `01a0e674-dbbf-75e0-a420-${(970000000000 + index).toString()}`;
	const events: {
		id: string;
		type: string;
		occurredAt: string;
		payload: Record<string, unknown>;
	}[] = [];
	const at = (time: number) => new Date(time).toISOString();
	const start = now - 30 * DAY + index * 2 * DAY;
	events.push({ id: id("e"), type: "machine.created", occurredAt: at(start), payload: {} });
	events.push({
		id: id("e"),
		type: "machine.started",
		occurredAt: at(start + 60_000),
		payload: {},
	});
	let realized = 0;
	let wins = 0;
	let losses = 0;
	let price = 118 + next() * 6;
	const step = (now - start - DAY) / plan.trips;
	for (let trip = 0; trip < plan.trips; trip += 1) {
		const spend = Math.max(5, plan.budget * 0.6) * 1_000_000;
		const bought = Math.round((spend / price) * 1e9);
		const buyAt = start + DAY / 2 + trip * step;
		const move = plan.edge + (next() - 0.5) * 0.03;
		price = price * (1 + (next() - 0.5) * 0.02);
		const back = Math.round(spend * (1 + move));
		const buyId = id("t");
		const sellId = id("t");
		events.push(
			{
				id: id("e"),
				type: "trade.intended",
				occurredAt: at(buyAt),
				payload: { tradeId: buyId, inputMint: USDC, outputMint: SOL },
			},
			{
				id: id("e"),
				type: "trade.completed",
				occurredAt: at(buyAt + 4_000),
				payload: {
					tradeId: buyId,
					inputAmount: String(Math.round(spend)),
					outputAmount: String(bought),
				},
			},
		);
		if (next() < 0.12)
			events.push({
				id: id("e"),
				type: "trade.refused",
				occurredAt: at(buyAt + step * 0.3),
				payload: { reason: "today's spending would pass the daily cap" },
			});
		const sellAt = buyAt + step * 0.6;
		events.push(
			{
				id: id("e"),
				type: "trade.intended",
				occurredAt: at(sellAt),
				payload: { tradeId: sellId, inputMint: SOL, outputMint: USDC },
			},
			{
				id: id("e"),
				type: "trade.completed",
				occurredAt: at(sellAt + 4_000),
				payload: { tradeId: sellId, inputAmount: String(bought), outputAmount: String(back) },
			},
		);
		realized += back - spend;
		if (back >= spend) wins += 1;
		else losses += 1;
	}
	if (plan.state === "paused")
		events.push({ id: id("e"), type: "machine.paused", occurredAt: at(now - DAY), payload: {} });
	if (plan.state === "stopped")
		events.push({
			id: id("e"),
			type: "machine.stopped",
			occurredAt: at(now - 3 * DAY),
			payload: {},
		});
	const granted = String(Math.round(plan.budget * 1_000_000));
	const summary = {
		machineId,
		name: plan.name,
		kind: plan.kind,
		walletAddress: `6kSDVbEQwULz832Fqga87zxxLiZyCzKgsqWSXt2NXa${index}y`,
		createdAt: at(start),
		paper: plan.paper,
		state: plan.state,
		budget: { granted, reserved: "0", settled: "0", available: granted },
		result: {
			realised: String(Math.round(realized)),
			position: "0",
			basis: "0",
			feesLamports: String(plan.trips * 2 * 5_000),
			trades: plan.trips * 2,
			roundTrips: plan.trips,
			wins,
			losses,
			simulated: plan.paper,
		},
	};
	const detail = {
		...summary,
		settings: {
			quoteMint: USDC,
			baseMint: SOL,
			bandBps: 250,
			floorBps: 800,
			amountPerBuy: granted,
			slippageBps: 50,
		},
		limits: { maxPerTrade: granted, maxPerDay: granted, approvedMints: [USDC, SOL] },
		actions:
			plan.state === "running"
				? ["pause", "stop"]
				: plan.state === "paused"
					? ["resume", "stop"]
					: [],
		levels: [],
	};
	return { summary, detail, record: [...events].reverse(), machineId };
}

const fleet = PLANS.map(build);

const trader = {
	id: "seed-run",
	mode: "paper",
	status: "running",
	startedAt: new Date(now - 3 * 3_600_000).toISOString(),
	startingCash: "40.00",
	cash: "21.40",
	worth: "42.86",
	realized: "1.73",
	fees: "0.06",
	trades: 11,
	holdings: [
		{
			symbol: "WIF",
			mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
			cost: "10.00",
			worth: "11.21",
		},
		{
			symbol: "BONK",
			mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
			cost: "9.80",
			worth: "10.25",
		},
	],
	thinking: { spentUsd: 0.41, turns: 14, lastAt: new Date(now - 90_000).toISOString() },
	log: [
		{
			at: new Date(now - 90_000).toISOString(),
			kind: "think",
			text: "Holding WIF and BONK. Both above cost with rising five minute volume; exits set.",
			costUsd: 0.031,
		},
		{
			at: new Date(now - 8 * 60_000).toISOString(),
			kind: "sell",
			text: "Sold POPCAT for $10.92 (+$0.89): took profit at +8.9%, the plan was +8%",
		},
		{
			at: new Date(now - 26 * 60_000).toISOString(),
			kind: "refused",
			text: "Did not buy THIN: the trade would move the price 5.1%, over the 3% limit",
		},
		{
			at: new Date(now - 41 * 60_000).toISOString(),
			kind: "buy",
			text: "Bought $10.00 of WIF: organic volume rising with a clean 1h trend",
		},
	],
};

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function answer(url: URL, method: string): Response | undefined {
	const path = url.pathname;
	if (path === "/v1/auth/me") return json({ ownerId: "seed-owner", walletAddress: OWNER });
	if (path === "/v1/machines" && method === "GET")
		return json({ machines: fleet.map((each) => each.summary) });
	const one = /^\/v1\/machines\/([^/]+)(\/[a-z]+)?$/.exec(path);
	const found = fleet.find((each) => each.machineId === one?.[1]);
	if (one && found) {
		if (!one[2]) return json(found.detail);
		if (one[2] === "/record")
			return json({ events: found.record.slice(0, Number(url.searchParams.get("limit") ?? 200)) });
		if (one[2] === "/balances")
			return json({
				wallet: {
					address: found.summary.walletAddress,
					lamports: "12000000",
					tokens: [{ mint: USDC, amount: found.summary.budget.granted, decimals: 6 }],
				},
				vault: {
					address: "6JTAb5",
					lamports: "0",
					tokens: [
						{
							mint: USDC,
							amount: String(Math.max(0, Number(found.summary.result.realised))),
							decimals: 6,
						},
					],
				},
			});
	}
	if (path === "/v1/manager/key")
		return json({ set: true, hint: "2gAA", setAt: new Date(now - DAY).toISOString() });
	if (path === "/v1/manager/trader") return json({ run: trader });
	return undefined;
}

export function seedRequested(): boolean {
	const asked = new URLSearchParams(window.location.search).get("seed");
	try {
		if (asked === "on") localStorage.setItem(KEY, "1");
		if (asked === "off") localStorage.removeItem(KEY);
		return localStorage.getItem(KEY) === "1";
	} catch {
		return asked === "on";
	}
}

/** Answers the app's own API from the made-up data above; anything else goes out as usual. */
export function installSeed(gateway: string) {
	const host = new URL(gateway).host;
	const real = window.fetch.bind(window);
	window.fetch = async (input, init) => {
		const href = input instanceof Request ? input.url : String(input);
		const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
		const url = new URL(href, window.location.href);
		if (url.host === host) {
			const made = answer(url, method);
			if (made) return made;
		}
		return real(input, init);
	};
	// The one place the app speaks to the console: so nobody mistakes the made-up numbers for real ones.
	// biome-ignore lint/suspicious/noConsole: see above
	console.info("[maschina] showing made-up data. Visit with ?seed=off to stop.");
}
