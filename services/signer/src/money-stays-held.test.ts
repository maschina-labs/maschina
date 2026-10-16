/**
 * What has to be true before a budget is ever given back.
 *
 * A hold released for a trade that actually landed is the worst thing the signer can do. The money is
 * gone from the wallet and back in the budget at the same time, so the machine spends it twice, and the
 * trade is written down as failed, which means it never appears in the record anyone reads.
 *
 * Both tests here describe trades that reached the chain. Neither may release.
 */

import type { SignRequest } from "@maschina/contracts";
import { newId, ok } from "@maschina/core";
import { type ConfirmationReader, confirmSignature } from "@maschina/solana";
import { describe, expect, it } from "vitest";
import { type ChainPorts, chainSigner } from "./chain-signer.ts";
import { answerFrom } from "./compose.ts";
import type { Submission } from "./submit-once.ts";
import { type BudgetLedger, withBudget } from "./with-budget.ts";

const SIGNATURE = "4".repeat(88);
const COST = { inputAmount: 100_000n, outputAmount: 14_010_000n, feeLamports: 25_000n };

const proposal = (lastValidBlockHeight: string): SignRequest => ({
	proposalId: newId<"proposal">(),
	runId: newId<"run">(),
	tradeId: newId<"trade">(),
	machineId: newId<"machine">(),
	wallet: "WaLLet1111111111111111111111111111111111111",
	transaction: Buffer.from([1, 2, 3]).toString("base64"),
	lastValidBlockHeight,
	trade: {
		inputMint: "So11111111111111111111111111111111111111112",
		outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		inputAmount: "100000",
		quotedOutputAmount: "14000000",
		minimumOutputAmount: "13900000",
		slippageBps: 50,
		router: "jupiter",
	},
});

/** Chain ports that sign, record the signature and send, with everything after that left to the test. */
function reachingTheChain(overrides: Partial<ChainPorts["chain"]> = {}) {
	const released: string[] = [];
	let recorded: Submission | undefined;

	const ports: ChainPorts = {
		checkShape: () => {},
		walletIdFor: async () => "wallet-1",
		provider: { sign: async () => ok(new Uint8Array([9, 9, 9])) },
		signatureOf: () => SIGNATURE,
		submissions: {
			submissionFor: async () => recorded,
			recordSubmission: async (_request, submission) => {
				recorded = submission;
			},
		},
		chain: {
			send: async () => {},
			confirm: async () => ({ outcome: "landed", signature: SIGNATURE, slot: 9n }),
			costOf: async () => COST,
			...overrides,
		},
		outcomes: {
			settle: async () => {},
			release: async (_request, stage, reason) => {
				released.push(`${stage}: ${reason}`);
			},
			recordRefusal: async () => {},
		},
	};

	return { ports, released, submitted: () => recorded };
}

/** A ledger that holds, and remembers anything given back. */
function ledgerThatHolds() {
	const returned: string[] = [];
	const ledger: BudgetLedger = {
		async hold() {
			return { reserved: 100_005_000n };
		},
		async giveBack(_request, reason) {
			returned.push(reason);
		},
	};
	return { ledger, returned };
}

describe("a trade that landed", () => {
	it("keeps its hold when reading what it cost throws", async () => {
		// The transaction is on the chain. Only the question about what it cost failed, which says
		// nothing at all about the money, so the money may not move back.
		const chain = reachingTheChain({
			costOf: async () => {
				throw new Error("the rpc node is unavailable");
			},
		});
		const budget = ledgerThatHolds();

		await expect(
			withBudget(chainSigner(chain.ports), budget.ledger).sign(proposal("426070577")),
		).rejects.toThrow("the rpc node is unavailable");

		expect(chain.submitted()?.signature).toBe(SIGNATURE);
		expect(budget.returned).toEqual([]);
	});
});

describe("a trade whose expiry came from the node", () => {
	it("is not declared never sent on the node's word alone", async () => {
		// A node that says the transaction expired at height 0 is saying it was dead before it was
		// written. The chain has not seen the signature yet, which is normal a moment after sending, so
		// the only honest answer is that nothing is known yet. Declaring it never sent frees the budget
		// while the transaction is still live on the network.
		const seenNothing: ConfirmationReader = {
			statusOf: async () => undefined,
			blockHeight: async () => 426_070_577n,
		};

		const chain = reachingTheChain({
			confirm: async (_request, submission) =>
				answerFrom(
					await confirmSignature(
						seenNothing,
						{
							signature: submission.signature,
							lastValidBlockHeight: submission.lastValidBlockHeight,
						},
						{ timeoutMs: 20, pollMs: 10, sleep: async () => {} },
					),
				),
		});
		const budget = ledgerThatHolds();

		await withBudget(chainSigner(chain.ports), budget.ledger).sign(proposal("0"));

		expect(chain.released).toEqual([]);
	});
});
