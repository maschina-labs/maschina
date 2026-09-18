import type { SignRequest, SignResponse } from "@maschina/contracts";
import { MaschinaError, newId } from "@maschina/core";
import { describe, expect, it } from "vitest";
import type { TradeSigner } from "./sign-route.ts";
import { type BudgetLedger, withBudget } from "./with-budget.ts";

const WALLET = "3KnH6rpESZRFFU7b4vTqUpcyGeTBzXww21vmRFqpbEQF";
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIGNATURE =
	"2gCEqMVor2LxnpCrgWjhrDMfYF7nfM73f947HkZotuzaMrmd1xff2Bq4eF8z6VPVsSzRse1mvDaTj2sdPZsFCY4X";

const proposal = (): SignRequest => ({
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
});

/** A ledger that holds when told to, and remembers every hold and every release. */
function fakeLedger(options: { holds?: boolean } = {}) {
	const held: string[] = [];
	const returned: { tradeId: string; reason: string }[] = [];

	const ledger: BudgetLedger = {
		async hold(request) {
			if (options.holds === false) return undefined;
			held.push(request.tradeId);
			return { reserved: 100_005_000n };
		},
		async giveBack(request, reason) {
			returned.push({ tradeId: request.tradeId, reason });
		},
	};

	return { ledger, held, returned };
}

/** A signer that answers however the test says, and records the order things happened in. */
function fakeSigner(order: string[], answer: (request: SignRequest) => SignResponse): TradeSigner {
	return {
		async sign(request) {
			order.push("signed");
			return answer(request);
		},
	};
}

const signs = (request: SignRequest): SignResponse => ({
	status: "signed",
	proposalId: request.proposalId,
	signature: SIGNATURE,
});

describe("holding the money", () => {
	it("happens before anything is signed", async () => {
		const order: string[] = [];
		const fake = fakeLedger();
		const ledger: BudgetLedger = {
			async hold(request) {
				order.push("held");
				return fake.ledger.hold(request);
			},
			giveBack: fake.ledger.giveBack,
		};

		await withBudget(fakeSigner(order, signs), ledger).sign(proposal());

		expect(order).toEqual(["held", "signed"]);
	});

	it("refuses the trade when the budget cannot hold it, and never signs", async () => {
		const order: string[] = [];
		const fake = fakeLedger({ holds: false });

		const answer = await withBudget(fakeSigner(order, signs), fake.ledger).sign(proposal());

		expect(answer).toMatchObject({ status: "refused", by: "maschina", rule: "budget" });
		expect(order).toEqual([]);
	});

	it("keeps the hold when the trade is signed", async () => {
		const fake = fakeLedger();

		const answer = await withBudget(fakeSigner([], signs), fake.ledger).sign(proposal());

		expect(answer.status).toBe("signed");
		expect(fake.held).toHaveLength(1);
		expect(fake.returned).toHaveLength(0);
	});
});

describe("giving the money back", () => {
	it("happens when the trade is refused further in", async () => {
		const fake = fakeLedger();
		const sent = proposal();
		const refusing = fakeSigner([], (request) => ({
			status: "refused",
			proposalId: request.proposalId,
			by: "provider",
			rule: "policy",
			reason: "the provider's policy refused it",
		}));

		const answer = await withBudget(refusing, fake.ledger).sign(sent);

		expect(answer).toMatchObject({ status: "refused", by: "provider" });
		expect(fake.returned).toEqual([
			{ tradeId: sent.tradeId, reason: "refused by provider: policy" },
		]);
	});

	it("happens when signing fails, because nothing was signed", async () => {
		const fake = fakeLedger();
		const broken: TradeSigner = {
			async sign() {
				throw new MaschinaError("unavailable", "the provider is down");
			},
		};

		await expect(withBudget(broken, fake.ledger).sign(proposal())).rejects.toMatchObject({
			code: "unavailable",
		});
		expect(fake.returned[0]?.reason).toContain("unavailable");
	});

	it("carries the failure on rather than turning it into a refusal", async () => {
		const fake = fakeLedger();
		const broken: TradeSigner = {
			async sign() {
				throw new Error("something unexpected");
			},
		};

		// A failure is not a refusal: the run loop retries one and records the other.
		await expect(withBudget(broken, fake.ledger).sign(proposal())).rejects.toThrow(
			"something unexpected",
		);
		expect(fake.returned[0]?.reason).toBe("something unexpected");
	});

	it("gives back once, not twice", async () => {
		const fake = fakeLedger();
		const refusing = fakeSigner([], (request) => ({
			status: "refused",
			proposalId: request.proposalId,
			by: "maschina",
			rule: "daily_cap",
			reason: "the daily cap",
		}));

		await withBudget(refusing, fake.ledger).sign(proposal());

		expect(fake.returned).toHaveLength(1);
	});
});
