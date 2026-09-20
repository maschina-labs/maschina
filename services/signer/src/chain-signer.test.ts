import type { SignRequest } from "@maschina/contracts";
import { err, newId, ok } from "@maschina/core";
import { providerError } from "@maschina/wallet";
import { describe, expect, it } from "vitest";
import { type ChainPorts, chainSigner } from "./chain-signer.ts";
import type { ChainAnswer, Submission } from "./submit-once.ts";

const request: SignRequest = {
	proposalId: newId<"proposal">(),
	runId: newId<"run">(),
	tradeId: newId<"trade">(),
	machineId: newId<"machine">(),
	wallet: "WaLLet1111111111111111111111111111111111111",
	transaction: Buffer.from([1, 2, 3]).toString("base64"),
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

const SIGNATURE = "5".repeat(88);
const COST = { inputAmount: 100_000n, outputAmount: 14_010_000n, feeLamports: 25_000n };

/** Ports that do the happy thing, and write down everything that happened, in order. */
function ports(
	overrides: Partial<ChainPorts> = {},
	answer: ChainAnswer = { outcome: "landed", signature: SIGNATURE, slot: 9n },
) {
	const log: string[] = [];
	let recorded: Submission | undefined;
	const base: ChainPorts = {
		checkShape: () => log.push("check"),
		walletIdFor: async () => "wallet-1",
		provider: {
			sign: async () => {
				log.push("sign");
				return ok(new Uint8Array([9, 9, 9]));
			},
		},
		signatureOf: () => SIGNATURE,
		submissions: {
			submissionFor: async () => recorded,
			recordSubmission: async (_request, submission) => {
				log.push("record");
				recorded = submission;
			},
		},
		chain: {
			send: async () => {
				log.push("send");
			},
			confirm: async () => {
				log.push("confirm");
				return answer;
			},
			costOf: async () => COST,
		},
		outcomes: {
			settle: async (_request, signature, cost) => {
				log.push(`settle ${signature === SIGNATURE} ${cost.outputAmount}`);
			},
			release: async (_request, stage, reason) => {
				log.push(`release ${stage} ${reason}`);
			},
			recordRefusal: async (_request, refusal) => {
				log.push(`refused ${refusal.by} ${refusal.rule}`);
			},
		},
	};
	return { ports: { ...base, ...overrides }, log };
}

describe("the signer that touches the chain", () => {
	it("records the signature before sending, and settles at what the chain says it cost", async () => {
		const { ports: p, log } = ports();
		const answer = await chainSigner(p).sign(request);

		expect(answer).toEqual({
			status: "signed",
			proposalId: request.proposalId,
			signature: SIGNATURE,
		});
		expect(log).toEqual(["check", "sign", "record", "send", "confirm", "settle true 14010000"]);
	});

	it("never signs twice: a trade already sent is asked about, not sent again", async () => {
		const { ports: p, log } = ports({
			submissions: {
				submissionFor: async () => ({ signature: SIGNATURE, lastValidBlockHeight: 1000n }),
				recordSubmission: async () => {
					throw new Error("must not record twice");
				},
			},
		});
		await chainSigner(p).sign(request);
		expect(log).toEqual(["check", "confirm", "settle true 14010000"]);
	});

	it("gives the budget back when the trade failed on chain", async () => {
		const { ports: p, log } = ports(
			{},
			{ outcome: "failed", signature: SIGNATURE, reason: "slippage exceeded" },
		);
		const answer = await chainSigner(p).sign(request);
		expect(answer.status).toBe("signed");
		expect(log.at(-1)).toBe("release submit slippage exceeded");
	});

	it("gives the budget back when the transaction expired without landing", async () => {
		const { ports: p, log } = ports({}, { outcome: "expired", signature: SIGNATURE });
		await chainSigner(p).sign(request);
		expect(log.at(-1)).toMatch(/^release confirm /);
	});

	it("leaves a trade the chain cannot answer for open, neither settled nor released", async () => {
		const { ports: p, log } = ports(
			{},
			{ outcome: "unknown", signature: SIGNATURE, because: "rpc down" },
		);
		const answer = await chainSigner(p).sign(request);
		expect(answer.status).toBe("signed");
		expect(log.some((entry) => entry.startsWith("settle") || entry.startsWith("release"))).toBe(
			false,
		);
	});

	it("records a refusal by the wallet provider, and sends nothing", async () => {
		const { ports: p, log } = ports({
			provider: { sign: async () => err(providerError("refused", "policy denied")) },
		});
		const answer = await chainSigner(p).sign(request);

		expect(answer).toMatchObject({ status: "refused", by: "provider", rule: "provider_policy" });
		expect(log).toEqual(["check", "refused provider provider_policy"]);
	});

	it("fails loudly when the provider cannot be reached, so the hold is given back", async () => {
		const { ports: p } = ports({
			provider: { sign: async () => err(providerError("unavailable", "turnkey is down")) },
		});
		await expect(chainSigner(p).sign(request)).rejects.toThrow(/turnkey is down/);
	});

	it("refuses a transaction that is not a plain swap from this wallet, before anything is signed", async () => {
		const { ports: p, log } = ports({
			checkShape: () => {
				throw new Error("the transaction calls a program a swap should not call");
			},
		});
		const answer = await chainSigner(p).sign(request);

		expect(answer).toMatchObject({ status: "refused", by: "maschina", rule: "transaction_shape" });
		expect(log).toEqual(["refused maschina transaction_shape"]);
	});

	it("refuses a machine with no wallet at the provider", async () => {
		const { ports: p } = ports({ walletIdFor: async () => undefined });
		expect(await chainSigner(p).sign(request)).toMatchObject({
			status: "refused",
			rule: "unknown_wallet",
		});
	});
});
