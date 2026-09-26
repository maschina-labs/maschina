import type { SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError, newId, ok } from "@maschina/core";
import { createLogger } from "@maschina/telemetry";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.ts";
import type { Leases, Signer, Simulator } from "./propose-route.ts";

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

function app(leases: Leases, signer: Signer, paperSigner?: Simulator) {
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
		paperSigner: paperSigner ?? {
			simulate: async () => {
				throw new Error("the paper signer must not be asked");
			},
		},
		renewals: { renew: async () => ok(new Date()) },
	});
}

const propose = (target: ReturnType<typeof app>, body: unknown) =>
	target.request("/internal/v1/runs/propose", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});

const holding: Leases = { holds: async () => ({ paper: false, machineId }) };
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
			app({ holds: async () => ({ paper: false, machineId: newId<"machine">() }) }, neverAsk),
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

const simulated = {
	status: "simulated" as const,
	proposalId: proposal.proposalId,
	tradeId: proposal.tradeId,
};

/** The same trade with nothing to sign, which is all a paper machine ever sends. */
const { transaction: _transaction, lastValidBlockHeight: _height, ...onPaper } = proposal;

const simulate = (target: ReturnType<typeof app>, body: unknown) =>
	target.request("/internal/v1/runs/simulate", {
		method: "POST",
		headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("a machine on paper", () => {
	it("is recorded by the signer that never signs, and the real one is not asked", async () => {
		const real = vi.fn(async () => signed);
		const paper = vi.fn(async () => simulated);

		const res = await simulate(
			app({ holds: async () => ({ paper: true, machineId }) }, { sign: real }, { simulate: paper }),
			{ nodeId, leaseEpoch: "1", proposal: onPaper },
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ status: "simulated" });
		// Not merely unused: the path that spends money is never asked in the first place.
		expect(real).not.toHaveBeenCalled();
		expect(paper).toHaveBeenCalledOnce();
	});

	it("cannot be signed for, even if the node proposes a real trade for it", async () => {
		const real = vi.fn(async () => signed);
		const res = await propose(
			app({ holds: async () => ({ paper: true, machineId }) }, { sign: real }),
			{ nodeId, leaseEpoch: "1", proposal },
		);

		expect(res.status).toBe(403);
		expect(real).not.toHaveBeenCalled();
	});

	it("still refuses a node that does not hold the run, paper or not", async () => {
		const paper = vi.fn(async () => simulated);

		const res = await simulate(
			app({ holds: async () => undefined }, neverAsk, { simulate: paper }),
			{
				nodeId,
				leaseEpoch: "1",
				proposal: onPaper,
			},
		);

		expect(res.status).toBe(409);
		expect(paper).not.toHaveBeenCalled();
	});

	it("refuses a simulation that still carries a transaction", async () => {
		const paper = vi.fn(async () => simulated);

		const res = await simulate(
			app({ holds: async () => ({ paper: true, machineId }) }, neverAsk, { simulate: paper }),
			{ nodeId, leaseEpoch: "1", proposal },
		);

		expect(res.status).toBe(400);
		expect(paper).not.toHaveBeenCalled();
	});
});

describe("a machine that trades for real", () => {
	it("cannot have a trade written into its record as if it were on paper", async () => {
		const paper = vi.fn(async () => simulated);

		const res = await simulate(app(holding, neverAsk, { simulate: paper }), {
			nodeId,
			leaseEpoch: "1",
			proposal: onPaper,
		});

		expect(res.status).toBe(403);
		expect(paper).not.toHaveBeenCalled();
	});
});
