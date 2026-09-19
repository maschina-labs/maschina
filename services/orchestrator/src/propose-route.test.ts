import type { SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError, newId, ok } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import type { Leases, Signer } from "./propose-route.ts";

const token = "d".repeat(40);
const logger = createLogger({ service: "test", level: "silent" });
const nodeId = newId<"node">();
const machineId = newId<"machine">();

const proposal: SignRequest = {
	proposalId: newId<"proposal">(),
	runId: newId<"run">(),
	tradeId: newId<"trade">(),
	machineId,
	wallet: "WaLLet1111111111111111111111111111111111111",
	transaction: "AAAA",
	lastValidBlockHeight: "1000",
	trade: {
		inputMint: "So11111111111111111111111111111111111111112",
		outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		inputAmount: "100000",
		quotedOutputAmount: "14000000",
		minimumOutputAmount: "13900000",
		slippageBps: 50,
		router: "jupiter",
	},
};

const signed: SignResponse = {
	status: "signed",
	proposalId: proposal.proposalId,
	signature: "5".repeat(88),
};

function app(leases: Leases, signer: Signer) {
	return buildApp({
		version: "1.0.0",
		daemonToken: token,
		logger,
		checks: [],
		runs: { claim: async () => ok(undefined) },
		reports: { report: async () => ok(undefined) },
		contexts: { contextFor: async () => undefined },
		leases,
		signer,
	});
}

const propose = (target: ReturnType<typeof app>, body: unknown) =>
	target.request("/internal/v1/runs/propose", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});

const holding: Leases = { holds: async () => ({ machineId }) };
const neverAsk: Signer = {
	sign: async () => {
		throw new Error("the signer must not be asked");
	},
};

describe("a node proposing a trade", () => {
	it("is passed to the signer, and gets the signer's answer back unchanged", async () => {
		const asked: SignRequest[] = [];
		const res = await propose(
			app(holding, {
				sign: async (request) => {
					asked.push(request);
					return signed;
				},
			}),
			{ nodeId, leaseEpoch: "2", proposal },
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(signed);
		expect(asked).toEqual([proposal]);
	});

	it("is refused when the node does not hold the run", async () => {
		const res = await propose(app({ holds: async () => undefined }, neverAsk), {
			nodeId,
			leaseEpoch: "2",
			proposal,
		});
		expect(res.status).toBe(409);
	});

	it("is refused when the proposal is for another machine than the run's", async () => {
		const res = await propose(
			app({ holds: async () => ({ machineId: newId<"machine">() }) }, neverAsk),
			{
				nodeId,
				leaseEpoch: "2",
				proposal,
			},
		);
		expect(res.status).toBe(403);
	});

	it("says try again later when the signer cannot be reached", async () => {
		const res = await propose(
			app(holding, {
				sign: async () => {
					throw new MaschinaError("unavailable", "the signer is down");
				},
			}),
			{ nodeId, leaseEpoch: "2", proposal },
		);
		expect(res.status).toBe(503);
	});

	it("refuses a malformed proposal before anything is checked", async () => {
		const res = await propose(app({ holds: async () => undefined }, neverAsk), {
			nodeId,
			leaseEpoch: "2",
			proposal: { ...proposal, extra: true },
		});
		expect(res.status).toBe(400);
	});
});
