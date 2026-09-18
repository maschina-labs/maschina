import type { SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError, newId } from "@maschina/core";
import { describe, expect, it } from "vitest";
import type { TradeSigner } from "./sign-route.ts";
import { type MachineFacts, type RecordKeeper, withRules } from "./with-rules.ts";

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
	options: { failWrites?: boolean } = {},
) => {
	const inner = countingSigner();
	const fake = fakeRecord(machineFacts, options);
	return { ...fake, inner, signer: withRules(inner.signer, fake.record, { now: () => NOW }) };
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

		const strict = withRules(inner.signer, fake.record, { now: () => NOW, graceMs: 60_000 });
		const lenient = withRules(inner.signer, fake.record, { now: () => NOW, graceMs: 30 * 60_000 });

		expect(await strict.sign(proposal())).toMatchObject({ rule: "run_due" });
		expect((await lenient.sign(proposal())).status).toBe("signed");
	});

	it("uses the real clock when nobody supplies one", async () => {
		const inner = countingSigner();
		const fake = fakeRecord(facts({ dueAt: new Date() }));

		const signer = withRules(inner.signer, fake.record);

		expect((await signer.sign(proposal())).status).toBe("signed");
	});
});
