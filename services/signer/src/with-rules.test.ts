import type { SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError, newId } from "@maschina/core";
import { describe, expect, it } from "vitest";
import type { TradeSigner } from "./sign-route.ts";
import {
	type MachineFacts,
	type MeasureTrade,
	type RecordKeeper,
	withRules,
} from "./with-rules.ts";

const WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const SIGNATURE =
	"2gCEqMVor2LxnpCrgWjhrDMfYF7nfM73f947HkZotuzaMrmd1xff2Bq4eF8z6VPVsSzRse1mvDaTj2sdPZsFCY4X";

const NOW = new Date("2026-09-18T15:00:00.000Z");

const proposal = (over: Partial<SignRequest> = {}): SignRequest => ({
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
		priceImpactBps: 3,
		router: "jupiter",
	},
	...over,
});

const facts = (over: Partial<MachineFacts> = {}): MachineFacts => ({
	state: "running",
	limits: { maxPerTrade: 500_000_000n, maxPerDay: 1_000_000_000n, approvedMints: [SOL, USDC] },
	availableBudget: 5_000_000_000n,
	spentToday: 0n,
	dueAt: NOW,
	...over,
});

/**
 * A measurement that agrees with the claim.
 *
 * Every case written before F-01 assumed the transaction did what it said, so this keeps them
 * saying what they always said. The cases where it disagrees say so explicitly.
 */
const agreeing: MeasureTrade = async (request) => ({
	ok: true,
	value: {
		lamports: -5_000n,
		tokens: [
			{ mint: request.trade.inputMint, delta: -BigInt(request.trade.inputAmount) },
			{ mint: request.trade.outputMint, delta: BigInt(request.trade.quotedOutputAmount) },
		],
	},
});

/** A record that answers with the facts given, and remembers what was written to it. */
function fakeRecord(answer: MachineFacts | undefined, options: { failWrites?: boolean } = {}) {
	const refusals: { rule: string; reason: string }[] = [];
	const pauses: { reason: string; detail: string }[] = [];

	const record: RecordKeeper = {
		async factsFor() {
			return answer;
		},
		async recordRefusal(_request, refusal) {
			if (options.failWrites) throw new MaschinaError("unavailable", "the record is unreachable");
			refusals.push(refusal);
		},
		async pauseMachine(_request, reason, detail) {
			if (options.failWrites) throw new MaschinaError("unavailable", "the record is unreachable");
			pauses.push({ reason, detail });
		},
	};

	return { record, refusals, pauses };
}

/** A signer that counts how many times it was actually reached. */
function countingSigner() {
	let signed = 0;
	const signer: TradeSigner = {
		async sign(request): Promise<SignResponse> {
			signed += 1;
			return { status: "signed", proposalId: request.proposalId, signature: SIGNATURE };
		},
	};
	return {
		signer,
		get signed() {
			return signed;
		},
	};
}

const rulesOver = (
	machineFacts: MachineFacts | undefined,
	options: { failWrites?: boolean; measure?: MeasureTrade } = {},
) => {
	const inner = countingSigner();
	const fake = fakeRecord(machineFacts, options);
	return {
		...fake,
		inner,
		signer: withRules(inner.signer, fake.record, options.measure ?? agreeing, {
			now: () => NOW,
		}),
	};
};

describe("a trade that breaks nothing", () => {
	it("reaches the signer and comes back signed", async () => {
		const setup = rulesOver(facts());

		const answer = await setup.signer.sign(proposal());

		expect(answer.status).toBe("signed");
		expect(setup.inner.signed).toBe(1);
		expect(setup.refusals).toHaveLength(0);
		expect(setup.pauses).toHaveLength(0);
	});

	it("judges the record's numbers, never the caller's", async () => {
		const setup = rulesOver(facts({ availableBudget: 1n }));

		// The proposal says nothing about budgets, and could not say anything that helps it.
		const answer = await setup.signer.sign(proposal());

		expect(answer).toMatchObject({ status: "refused", rule: "budget" });
		expect(setup.inner.signed).toBe(0);
	});
});

describe("a trade that breaks a rule", () => {
	it("never reaches the signer", async () => {
		const setup = rulesOver(facts({ state: "paused" }));

		await setup.signer.sign(proposal());

		expect(setup.inner.signed).toBe(0);
	});

	it("comes back as a refusal naming the rule, not as an error", async () => {
		const setup = rulesOver(facts({ state: "paused" }));

		const answer = await setup.signer.sign(proposal());

		expect(answer).toMatchObject({ status: "refused", by: "maschina", rule: "machine_running" });
	});

	it("is written to the record", async () => {
		const setup = rulesOver(facts({ state: "stopped" }));

		await setup.signer.sign(proposal());

		expect(setup.refusals).toEqual([
			{ rule: "machine_running", reason: "the machine is stopped, not running" },
		]);
	});

	it("pauses the machine when the breach means something is wrong", async () => {
		const setup = rulesOver(facts());

		await setup.signer.sign(
			proposal({
				trade: { ...proposal().trade, outputMint: JUP },
			}),
		);

		expect(setup.pauses).toHaveLength(1);
		expect(setup.pauses[0]).toMatchObject({ reason: "other" });
		expect(setup.refusals[0]).toMatchObject({ rule: "token_approved" });
	});

	it("pauses for an empty budget, using the record's own word for it", async () => {
		const setup = rulesOver(facts({ availableBudget: 0n }));

		await setup.signer.sign(proposal());

		expect(setup.pauses[0]).toMatchObject({ reason: "budget_exhausted" });
	});

	it("does not pause for a daily cap, which resets tomorrow", async () => {
		const setup = rulesOver(facts({ spentToday: 1_000_000_000n }));

		const answer = await setup.signer.sign(proposal());

		expect(answer).toMatchObject({ rule: "daily_cap" });
		expect(setup.pauses).toHaveLength(0);
	});

	it("refuses a run that is not due yet", async () => {
		const setup = rulesOver(facts({ dueAt: new Date(NOW.getTime() + 30 * 60_000) }));

		expect(await setup.signer.sign(proposal())).toMatchObject({ rule: "run_due" });
	});

	it("uses the run's own moment from the record, not anything the caller said", async () => {
		const setup = rulesOver(facts({ dueAt: new Date(NOW.getTime() - 3 * 60 * 60_000) }));

		expect(await setup.signer.sign(proposal())).toMatchObject({ rule: "run_due" });
	});
});

describe("a proposal about something the record does not know", () => {
	it("is refused without asking any rule", async () => {
		const setup = rulesOver(undefined);

		const answer = await setup.signer.sign(proposal());

		expect(answer).toMatchObject({ status: "refused", rule: "unknown_machine" });
		expect(setup.inner.signed).toBe(0);
	});
});

describe("when the record cannot be written to", () => {
	it("refuses the trade rather than refusing silently", async () => {
		const setup = rulesOver(facts({ state: "paused" }), { failWrites: true });

		// An unrecorded refusal is a lie: the owner would never see what happened.
		await expect(setup.signer.sign(proposal())).rejects.toMatchObject({ code: "unavailable" });
		expect(setup.inner.signed).toBe(0);
	});

	it("still never signs when the pause cannot be written", async () => {
		const setup = rulesOver(facts({ availableBudget: 0n }), { failWrites: true });

		await expect(setup.signer.sign(proposal())).rejects.toThrow(MaschinaError);
		expect(setup.inner.signed).toBe(0);
	});
});

describe("limits the owner never set", () => {
	it("applies no caps, but still approves only listed tokens", async () => {
		const setup = rulesOver(facts({ limits: { approvedMints: [SOL, USDC] } }));

		const answer = await setup.signer.sign(
			proposal({ trade: { ...proposal().trade, inputAmount: "4000000000" } }),
		);

		expect(answer.status).toBe("signed");
	});

	it("takes the grace period as a setting", async () => {
		const inner = countingSigner();
		const fake = fakeRecord(facts({ dueAt: new Date(NOW.getTime() - 10 * 60_000) }));

		const strict = withRules(inner.signer, fake.record, agreeing, {
			now: () => NOW,
			graceMs: 60_000,
		});
		const lenient = withRules(inner.signer, fake.record, agreeing, {
			now: () => NOW,
			graceMs: 30 * 60_000,
		});

		expect(await strict.sign(proposal())).toMatchObject({ rule: "run_due" });
		expect((await lenient.sign(proposal())).status).toBe("signed");
	});

	it("uses the real clock when nobody supplies one", async () => {
		const inner = countingSigner();
		const fake = fakeRecord(facts({ dueAt: new Date() }));

		const signer = withRules(inner.signer, fake.record, agreeing);

		expect((await signer.sign(proposal())).status).toBe("signed");
	});
});

describe("a sale", () => {
	// A range machine selling the SOL it bought: 0.08 SOL is 80,000,000 lamports, against caps and a
	// budget counted in USDC. Judged in lamports it is refused, and the machine can never sell.
	const tightFacts = (over: Partial<MachineFacts> = {}) =>
		facts({
			budgetMint: USDC,
			limits: { maxPerTrade: 10_000_000n, maxPerDay: 20_000_000n, approvedMints: [SOL, USDC] },
			availableBudget: 0n,
			...over,
		});
	const sale = proposal({
		trade: {
			inputMint: SOL,
			outputMint: USDC,
			inputAmount: "80000000",
			quotedOutputAmount: "9800000",
			minimumOutputAmount: "9751000",
			slippageBps: 50,
			priceImpactBps: 3,
			router: "jupiter",
		},
	});

	it("reaches the signer when the record says what the budget is counted in", async () => {
		const { signer, inner } = rulesOver(tightFacts());
		expect(await signer.sign(sale)).toMatchObject({ status: "signed" });
		expect(inner.signed).toBe(1);
	});

	it("is held to the caps when the record cannot say, which is the safe way round", async () => {
		const { signer, inner } = rulesOver(tightFacts({ budgetMint: undefined }));
		expect(await signer.sign(sale)).toMatchObject({ status: "refused" });
		expect(inner.signed).toBe(0);
	});
});

describe("judging the transaction rather than the claim", () => {
	/** A measurement that says the transaction does something other than what it claims. */
	const measuring =
		(tokens: { mint: string; delta: bigint }[], lamports = -5_000n): MeasureTrade =>
		async () => ({ ok: true, value: { lamports, tokens } });

	it("judges the budget against what the transaction really spends", async () => {
		// The claim is 0.1 SOL. The transaction spends 50, far past the per-trade cap. Before F-01
		// the rules read the claim and this was signed.
		const setup = rulesOver(facts(), {
			measure: measuring([
				{ mint: SOL, delta: -50_000_000_000n },
				{ mint: USDC, delta: 10_587_977n },
			]),
		});

		const answer = await setup.signer.sign(proposal());

		expect(answer.status).toBe("refused");
		expect(setup.inner.signed).toBe(0);
	});

	it("refuses and pauses when the deed contradicts the claim", async () => {
		// A node lying about its own trade is a node that has stopped being trustworthy. That is not
		// an owner's limit saying no, so the machine stops rather than trying again.
		const setup = rulesOver(facts(), {
			measure: measuring([
				{ mint: SOL, delta: -200_000_000n },
				{ mint: USDC, delta: 10_587_977n },
			]),
		});

		const answer = await setup.signer.sign(proposal());

		expect(answer.status).toBe("refused");
		expect(setup.refusals[0]?.rule).toBe("derived_mismatch");
		expect(setup.pauses).toHaveLength(1);
	});

	it("refuses when a token the trade never mentioned leaves the wallet", async () => {
		const setup = rulesOver(facts(), {
			measure: measuring([
				{ mint: SOL, delta: -100_000_000n },
				{ mint: USDC, delta: 10_587_977n },
				{ mint: JUP, delta: -4_000_000n },
			]),
		});

		const answer = await setup.signer.sign(proposal());

		expect(answer.status).toBe("refused");
		expect(setup.refusals[0]?.rule).toBe("derived_mismatch");
		expect(setup.inner.signed).toBe(0);
	});

	it("refuses without pausing when the chain cannot be asked", async () => {
		// An outage is not the machine's fault, so it is refused and left able to try again.
		const setup = rulesOver(facts(), {
			measure: async () => ({
				ok: false,
				error: new MaschinaError("unavailable", "the node could not be reached"),
			}),
		});

		const answer = await setup.signer.sign(proposal());

		expect(answer.status).toBe("refused");
		expect(setup.refusals[0]?.rule).toBe("simulation_failed");
		expect(setup.pauses).toEqual([]);
		expect(setup.inner.signed).toBe(0);
	});

	it("never reaches the measurement for a machine the record does not know", async () => {
		// Nothing is simulated on behalf of something that does not exist.
		let asked = 0;
		const setup = rulesOver(undefined, {
			measure: async () => {
				asked += 1;
				return { ok: true, value: { lamports: 0n, tokens: [] } };
			},
		});

		await setup.signer.sign(proposal());

		expect(asked).toBe(0);
	});
});

describe("spending SOL, which never moves as a token", () => {
	/** The claim and the measurement agree. The spend arrives as lamports, the way it really does. */
	const sellingSol = (lamports: bigint): MeasureTrade => {
		return async () => ({
			ok: true,
			value: { lamports: -lamports - 5_000n, tokens: [{ mint: USDC, delta: 60_000_000n }] },
		});
	};

	const selling = (lamports: bigint) =>
		proposal({
			trade: {
				inputMint: SOL,
				outputMint: USDC,
				inputAmount: lamports.toString(),
				quotedOutputAmount: "60000000",
				minimumOutputAmount: "59700000",
				slippageBps: 50,
				priceImpactBps: 3,
				router: "jupiter",
			},
		});

	it("holds a SOL spend to the per-trade cap, though no token moved", async () => {
		// The router wraps and unwraps, so a sold SOL is never a token balance. Reading only tokens
		// measures the spend as nothing, and nothing passes every cap there is.
		const setup = rulesOver(
			facts({ limits: { maxPerTrade: 500_000_000n, approvedMints: [SOL, USDC] } }),
			{
				measure: sellingSol(600_000_000n),
			},
		);

		const answer = await setup.signer.sign(selling(600_000_000n));

		expect(answer.status).toBe("refused");
		expect(setup.refusals[0]?.rule).toBe("per_trade_cap");
		expect(setup.inner.signed).toBe(0);
	});

	it("holds a SOL spend to the budget, though no token moved", async () => {
		const setup = rulesOver(
			facts({
				availableBudget: 100_000_000n,
				limits: { maxPerTrade: 900_000_000n, approvedMints: [SOL, USDC] },
			}),
			{ measure: sellingSol(600_000_000n) },
		);

		const answer = await setup.signer.sign(selling(600_000_000n));

		expect(answer.status).toBe("refused");
		expect(setup.refusals[0]?.rule).toBe("budget");
		expect(setup.inner.signed).toBe(0);
	});

	it("signs a SOL spend that is within every limit", async () => {
		const setup = rulesOver(facts(), { measure: sellingSol(100_000_000n) });

		const answer = await setup.signer.sign(selling(100_000_000n));

		expect(answer.status).toBe("signed");
	});
});

describe("judging the price before judging the trade", () => {
	/** The same proposal with a different slippage, and a floor that matches it honestly. */
	const at = (slippageBps: number) =>
		proposal({
			trade: {
				inputMint: SOL,
				outputMint: USDC,
				inputAmount: "100000000",
				quotedOutputAmount: "10000000",
				minimumOutputAmount: ((10_000_000n * BigInt(10_000 - slippageBps)) / 10_000n).toString(),
				slippageBps,
				priceImpactBps: 3,
				router: "jupiter",
			},
		});

	it("refuses slippage past the ceiling and pauses, though the floor is honest", async () => {
		const setup = rulesOver(facts());

		const answer = await setup.signer.sign(at(400));

		expect(answer.status).toBe("refused");
		expect(setup.refusals[0]?.rule).toBe("slippage_cap");
		expect(setup.pauses).toHaveLength(1);
		expect(setup.inner.signed).toBe(0);
	});

	it("uses the owner's own cap when the record has one, over the built-in ceiling", async () => {
		// 100 bps would pass the default ceiling of 300. The owner said 50.
		const setup = rulesOver(
			facts({
				limits: { maxPerTrade: 500_000_000n, approvedMints: [SOL, USDC], maxSlippageBps: 50 },
			}),
		);

		const answer = await setup.signer.sign(at(100));

		expect(answer.status).toBe("refused");
		expect(setup.refusals[0]?.rule).toBe("slippage_cap");
	});

	it("lets the owner allow more than the built-in ceiling", async () => {
		const setup = rulesOver(
			facts({
				limits: { maxPerTrade: 500_000_000n, approvedMints: [SOL, USDC], maxSlippageBps: 500 },
			}),
		);

		expect((await setup.signer.sign(at(400))).status).toBe("signed");
	});

	it("never asks a node about a quote the owner already forbade", async () => {
		// The cheap check comes first. Simulating a trade that cannot be allowed is a round trip
		// spent to learn nothing.
		let asked = 0;
		const setup = rulesOver(facts(), {
			measure: async () => {
				asked += 1;
				return { ok: true, value: { lamports: 0n, tokens: [] } };
			},
		});

		await setup.signer.sign(at(400));

		expect(asked).toBe(0);
	});

	it("refuses a floor of nothing, which would make the measured check meaningless", async () => {
		// Without this, a node sets the floor to zero and `judgeSwap` accepts whatever comes back.
		const setup = rulesOver(facts());

		const answer = await setup.signer.sign(
			proposal({
				trade: {
					inputMint: SOL,
					outputMint: USDC,
					inputAmount: "100000000",
					quotedOutputAmount: "10000000",
					minimumOutputAmount: "0",
					slippageBps: 50,
					priceImpactBps: 3,
					router: "jupiter",
				},
			}),
		);

		expect(answer.status).toBe("refused");
		expect(setup.refusals[0]?.rule).toBe("minimum_output");
	});

	it("refuses a trade that moves the price too far, without pausing", async () => {
		const setup = rulesOver(facts());

		const answer = await setup.signer.sign(
			proposal({
				trade: {
					inputMint: SOL,
					outputMint: USDC,
					inputAmount: "100000000",
					quotedOutputAmount: "10000000",
					minimumOutputAmount: "9950000",
					slippageBps: 50,
					priceImpactBps: 2_000,
					router: "jupiter",
				},
			}),
		);

		expect(answer.status).toBe("refused");
		expect(setup.refusals[0]?.rule).toBe("price_impact");
		expect(setup.pauses).toEqual([]);
	});
});
