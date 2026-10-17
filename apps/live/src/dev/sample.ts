/**
 * Made-up trades for looking at this page while building it.
 *
 * Development only. The plugin that loads this is `apply: "serve"`, so a build never sees the file
 * and nothing here can reach a deployed page. It answers the gateway's open route and nothing else,
 * so everything the page does with the answer is exercised for real: the schema, the two tables, the
 * links, the formatting.
 *
 * The numbers are the shape of Ash's real ones (40 USDC a trade, SOL around 118 to 123), so the page
 * is judged on what it will actually show rather than on tidy round figures.
 */

const SIGNATURES = [
	"2gCEqMVor2LxnpCrgWjhrDMfYF7nfM73f947HkZotuzaMrmd1xff2Bq4eF8z6VPVsSzRse1mvDaTj2sdPZsFCY4X",
	"3HSB85Rm9DLa9E3Nq7QR6e4rWX712dTvzJDQmy65rgixLgJGwVPrrNVnEeptJ2bW5PzaDi7tArsBzqa56FqkALFW",
	"5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW",
	"4bQ2YjDqW9Jf8kVxRtNmLpHgCsAeZuT7vXyB3nK6dFwPrMaQhU5SgJxEcV2DtY8iNbLoRkWfP1ZmXsHj7TqGvAcB",
];

/** USDC per SOL to the base units of each side, the way the record stores them. */
const trade = (at: string, side: "buy" | "sell", price: number, usdc: number) => ({
	at,
	side,
	usdc: String(Math.round(usdc * 1e6)),
	sol: String(Math.round((usdc / price) * 1e9)),
});

const live = [
	{ ...trade("2026-10-16T18:41:00.000Z", "sell", 122.7, 41.45), signature: SIGNATURES[0] },
	{ ...trade("2026-10-14T09:12:00.000Z", "buy", 119.02, 40.35), signature: SIGNATURES[1] },
	{ ...trade("2026-10-09T21:03:00.000Z", "sell", 121.75, 40.12), signature: SIGNATURES[2] },
	{ ...trade("2026-09-28T06:22:00.000Z", "buy", 118.68, 40.35), signature: SIGNATURES[3] },
];

const paper = [
	trade("2026-10-16T19:55:00.000Z", "buy", 121.4, 50),
	trade("2026-10-16T14:30:00.000Z", "sell", 123.1, 50.8),
	trade("2026-10-15T22:18:00.000Z", "buy", 120.05, 50),
];

/**
 * Proposals a machine was stopped from making, the thing this page exists to show. Both gates are
 * represented, because a reader should see that two different things refuse, and the amounts are
 * deliberately bigger than the real trades: a refusal is usually a machine asking for more than it
 * was given.
 */
const refused = [
	{ ...trade("2026-10-16T20:02:00.000Z", "buy", 121.4, 500), by: "maschina", rule: "budget" },
	{
		...trade("2026-10-15T11:40:00.000Z", "sell", 120.9, 80),
		by: "provider",
		rule: "provider_policy",
	},
	{
		...trade("2026-10-12T02:05:00.000Z", "buy", 119.5, 42),
		by: "maschina",
		rule: "transaction_shape",
	},
] as const;

/**
 * Answers the one route this page reads, and passes everything else through untouched.
 *
 * Silent on purpose: the console belongs to whoever is looking at the page, and the sample data
 * announces itself plainly enough by being four tidy trades.
 */
export function serveSampleRecord() {
	const real = globalThis.fetch;
	globalThis.fetch = async (input, init) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		if (url.includes("/v1/public/record")) {
			return new Response(JSON.stringify({ live, paper, refused }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		return real(input, init);
	};
}
