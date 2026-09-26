import type { SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError, newId } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { readProposal, type TradeSigner, type Withdrawer } from "./sign-route.ts";

const token = "s".repeat(40);
const WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIGNATURE =
	"2gCEqMVor2LxnpCrgWjhrDMfYF7nfM73f947HkZotuzaMrmd1xff2Bq4eF8z6VPVsSzRse1mvDaTj2sdPZsFCY4X";

const proposal = (over: Partial<Record<string, unknown>> = {}) => ({
	proposalId: newId(),
	runId: newId(),
	tradeId: newId(),
	machineId: newId(),
	wallet: WALLET,
	transaction: Buffer.from("a transaction").toString("base64"),
	lastValidBlockHeight: "426070577",
	trade: {
		inputMint: SOL,
		outputMint: USDC,
		inputAmount: "100000000",
		quotedOutputAmount: "10587977",
		minimumOutputAmount: "10535038",
		slippageBps: 50,
		router: "jupiter",
	},
	...over,
});

/** A signer that records what it was asked and answers however the test says. */
function fakeSigner(answer?: (request: SignRequest) => SignResponse) {
	const asked: SignRequest[] = [];
	const signer: TradeSigner = {
		async sign(request) {
			asked.push(request);
			return (
				answer?.(request) ?? {
					status: "signed",
					proposalId: request.proposalId,
					signature: SIGNATURE,
				}
			);
		},
	};
	return { signer, asked };
}

const appWith = (signer: TradeSigner, withdrawer?: Withdrawer) =>
	buildApp({
		version: "1.0.0",
		orchestratorToken: token,
		logger: createLogger({ service: "t", level: "silent" }),
		signer,
		withdrawer: withdrawer ?? {
			withdraw: async () => {
				throw new Error("the withdrawer must not be asked");
			},
		},
	});

const post = (app: ReturnType<typeof appWith>, body: unknown, auth = true) =>
	app.request("/internal/v1/sign", {
		method: "POST",
		body: typeof body === "string" ? body : JSON.stringify(body),
		headers: {
			"content-type": "application/json",
			...(auth ? { authorization: `Bearer ${token}` } : {}),
		},
	});

describe("the way in", () => {
	it("refuses a proposal with no credentials, and never asks the signer", async () => {
		const fake = fakeSigner();

		const response = await post(appWith(fake.signer), proposal(), false);

		expect(response.status).toBe(401);
		expect(fake.asked).toHaveLength(0);
	});

	it("refuses a proposal with the wrong credentials", async () => {
		const fake = fakeSigner();
		const response = await appWith(fake.signer).request("/internal/v1/sign", {
			method: "POST",
			body: JSON.stringify(proposal()),
			headers: { authorization: `Bearer ${"x".repeat(40)}`, "content-type": "application/json" },
		});

		expect(response.status).toBe(401);
		expect(fake.asked).toHaveLength(0);
	});

	it("accepts a well formed proposal and passes it on unchanged", async () => {
		const fake = fakeSigner();
		const sent = proposal();

		const response = await post(appWith(fake.signer), sent);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: "signed",
			proposalId: sent.proposalId,
			signature: SIGNATURE,
		});
		expect(fake.asked[0]).toEqual(sent);
	});

	it("passes a refusal back as an answer, not an error", async () => {
		const fake = fakeSigner((request) => ({
			status: "refused",
			proposalId: request.proposalId,
			by: "maschina",
			rule: "daily_cap",
			reason: "this trade would pass the daily cap",
		}));

		const response = await post(appWith(fake.signer), proposal());

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ status: "refused", rule: "daily_cap" });
	});

	it("says what was wrong with a malformed proposal", async () => {
		const fake = fakeSigner();

		const response = await post(appWith(fake.signer), proposal({ wallet: "not-an-address" }));
		const body = (await response.json()) as { error: { code: string; message: string } };

		expect(response.status).toBe(400);
		expect(body.error.code).toBe("invalid_input");
		expect(body.error.message).toContain("wallet");
		expect(fake.asked).toHaveLength(0);
	});

	it("refuses a body that is not JSON at all", async () => {
		const fake = fakeSigner();

		const response = await post(appWith(fake.signer), "{not json");

		expect(response.status).toBe(400);
		expect(fake.asked).toHaveLength(0);
	});
});

describe("what counts as a proposal", () => {
	it("takes a complete one", () => {
		expect(() => readProposal(proposal())).not.toThrow();
	});

	it.each([
		["a missing wallet", { wallet: undefined }],
		["an id that is not a v7 id", { runId: "1" }],
		["an amount with a decimal point", { trade: { ...proposal().trade, inputAmount: "1.5" } }],
		["a negative amount", { trade: { ...proposal().trade, inputAmount: "-1" } }],
		[
			"slippage past a whole hundred percent",
			{ trade: { ...proposal().trade, slippageBps: 10_001 } },
		],
		["a transaction that is not base64", { transaction: "not base64!" }],
		["a transaction too large to ever be sent", { transaction: "A".repeat(2001) }],
		["an empty transaction", { transaction: "" }],
		["an expiry that is not a number", { lastValidBlockHeight: "soon" }],
		["no trade at all", { trade: undefined }],
	])("refuses %s", (_name, over) => {
		expect(() => readProposal(proposal(over))).toThrow(MaschinaError);
	});

	it("refuses a field nobody asked for, rather than ignoring it", () => {
		// A field the signer does not understand is a field somebody expected it to act on.
		expect(() => readProposal(proposal({ skipRules: true }))).toThrow(/not valid/);
		expect(() =>
			readProposal(proposal({ trade: { ...proposal().trade, maximumSlippage: 9999 } })),
		).toThrow(/not valid/);
	});

	it("refuses something that is not an object", () => {
		expect(() => readProposal("a proposal")).toThrow(MaschinaError);
		expect(() => readProposal(null)).toThrow(MaschinaError);
	});
});

describe("when the signer cannot sign right now", () => {
	const unavailable = {
		sign: async (): Promise<never> => {
			throw new MaschinaError("unavailable", "the provider is down");
		},
	};

	it("answers a proposal with a 503, which the run loop treats as try again later", async () => {
		const response = await post(appWith(unavailable), proposal());

		expect(response.status).toBe(503);
	});
});

describe("the withdraw route", () => {
	const withdrawal = {
		withdrawalId: newId<"withdrawal">(),
		machineId: newId<"machine">(),
		lamports: "250000000",
	};

	const ask = (target: ReturnType<typeof appWith>, body: unknown) =>
		target.request("/internal/v1/withdraw", {
			method: "POST",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: JSON.stringify(body),
		});

	const never: TradeSigner = {
		sign: async () => {
			throw new Error("the signer must not be asked");
		},
	};

	it("passes the withdrawal on and gives the answer back unchanged", async () => {
		const asked: unknown[] = [];
		const answer = {
			status: "sent" as const,
			withdrawalId: withdrawal.withdrawalId,
			signature: "5".repeat(88),
			to: "G3q54fR9GtMX2EvEtwitP2tnmPRSvuXdVhpEE5nwuzKu",
			lamports: "250000000",
		};

		const res = await ask(
			appWith(never, {
				withdraw: async (request) => {
					asked.push(request);
					return answer;
				},
			}),
			withdrawal,
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(answer);
		expect(asked).toEqual([withdrawal]);
	});

	it("refuses a withdrawal that names a destination, because it does not get to choose one", async () => {
		// The one thing an owner cannot ask for. Where the money goes is looked up, never passed in.
		const res = await ask(appWith(never), {
			...withdrawal,
			to: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
		});

		expect(res.status).toBe(400);
	});

	it("refuses a withdrawal with no amount", async () => {
		const { lamports: _amount, ...withoutAmount } = withdrawal;
		expect((await ask(appWith(never), withoutAmount)).status).toBe(400);
	});

	it("refuses a body that is not JSON", async () => {
		const res = await appWith(never).request("/internal/v1/withdraw", {
			method: "POST",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: "not json",
		});
		expect(res.status).toBe(400);
	});

	it("is closed to anyone without the orchestrator's token", async () => {
		const res = await appWith(never).request("/internal/v1/withdraw", {
			method: "POST",
			body: JSON.stringify(withdrawal),
		});
		expect(res.status).toBe(401);
	});
});
