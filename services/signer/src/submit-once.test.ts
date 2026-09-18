import type { SignRequest } from "@maschina/contracts";
import { MaschinaError, newId } from "@maschina/core";
import { describe, expect, it } from "vitest";
import { type ChainAnswer, type Submission, type SubmitPorts, submitOnce } from "./submit-once.ts";

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

const landed: ChainAnswer = { outcome: "landed", signature: SIGNATURE, slot: 448_000_000n };

/**
 * A signer, a record and a chain, with everything they did written down in order, so a test can say
 * exactly what happened before what.
 */
function world(
	options: {
		existing?: Submission;
		answer?: ChainAnswer;
		waited?: ChainAnswer;
		sendFails?: Error;
		recordFails?: Error;
	} = {},
) {
	const order: string[] = [];
	const recorded: Submission[] = [];
	const sent: Uint8Array[] = [];
	let signings = 0;

	const ports: SubmitPorts = {
		async submissionFor() {
			order.push("looked for a signature");
			return options.existing;
		},
		async sign() {
			order.push("signed");
			signings += 1;
			return new Uint8Array([1, 2, 3]);
		},
		signatureOf() {
			return SIGNATURE;
		},
		async recordSubmission(_request, submission) {
			order.push("wrote down the signature");
			if (options.recordFails) throw options.recordFails;
			recorded.push(submission);
		},
		async send(signed) {
			order.push("sent");
			if (options.sendFails) throw options.sendFails;
			sent.push(signed);
		},
		async waitFor() {
			order.push("waited for the chain");
			return options.waited ?? landed;
		},
		async askChain() {
			order.push("asked the chain");
			return options.answer ?? landed;
		},
	};

	return {
		ports,
		order,
		recorded,
		sent,
		get signings() {
			return signings;
		},
	};
}

describe("a trade nobody has sent yet", () => {
	it("writes the signature down before sending it", async () => {
		const setup = world();

		await submitOnce(setup.ports, proposal());

		expect(setup.order).toEqual([
			"looked for a signature",
			"signed",
			"wrote down the signature",
			"sent",
			"waited for the chain",
		]);
	});

	it("records the signature the chain will know it by", async () => {
		const setup = world();

		await submitOnce(setup.ports, proposal());

		expect(setup.recorded[0]).toEqual({
			signature: SIGNATURE,
			lastValidBlockHeight: 426_070_577n,
		});
	});

	it("comes back with what the chain said", async () => {
		const setup = world();

		expect(await submitOnce(setup.ports, proposal())).toEqual({
			done: "landed",
			signature: SIGNATURE,
			slot: 448_000_000n,
		});
	});

	it("sends nothing when the signature could not be written down", async () => {
		const setup = world({ recordFails: new MaschinaError("unavailable", "the record is down") });

		await expect(submitOnce(setup.ports, proposal())).rejects.toThrow(MaschinaError);

		// Nothing was sent, so nothing happened, which is the recoverable half of the two failures.
		expect(setup.sent).toHaveLength(0);
		expect(setup.order).not.toContain("sent");
	});
});

describe("a trade that has been sent before", () => {
	const existing: Submission = { signature: SIGNATURE, lastValidBlockHeight: 426_070_577n };

	it("is never signed again, whatever happened to it", async () => {
		const setup = world({ existing });

		await submitOnce(setup.ports, proposal());

		expect(setup.signings).toBe(0);
		expect(setup.sent).toHaveLength(0);
	});

	it("asks the chain instead of guessing", async () => {
		const setup = world({ existing });

		const result = await submitOnce(setup.ports, proposal());

		expect(setup.order).toEqual(["looked for a signature", "asked the chain"]);
		expect(result).toMatchObject({ done: "landed" });
	});

	it("reports a trade that landed and failed as having happened", async () => {
		const setup = world({
			existing,
			answer: { outcome: "failed", signature: SIGNATURE, reason: "slippage" },
		});

		expect(await submitOnce(setup.ports, proposal())).toEqual({
			done: "failed",
			signature: SIGNATURE,
			reason: "slippage",
		});
	});

	it("only calls a trade unsent once it could never land", async () => {
		const setup = world({ existing, answer: { outcome: "expired", signature: SIGNATURE } });

		expect(await submitOnce(setup.ports, proposal())).toEqual({
			done: "never_sent",
			signature: SIGNATURE,
		});
	});

	it("leaves it unresolved while the chain has no answer, and still never re-signs", async () => {
		const setup = world({
			existing,
			answer: { outcome: "unknown", signature: SIGNATURE, because: "no record of it yet" },
		});

		const result = await submitOnce(setup.ports, proposal());

		expect(result).toMatchObject({ done: "unresolved" });
		expect(setup.signings).toBe(0);
	});
});

describe("when sending itself fails", () => {
	it("asks the chain, because a failed send is not proof of nothing arriving", async () => {
		const setup = world({ sendFails: new Error("socket hang up") });

		const result = await submitOnce(setup.ports, proposal());

		expect(setup.order).toEqual([
			"looked for a signature",
			"signed",
			"wrote down the signature",
			"sent",
			"asked the chain",
		]);
		expect(result).toMatchObject({ done: "landed" });
	});

	it("says it is unresolved when the chain cannot say either", async () => {
		const setup = world({
			sendFails: new Error("socket hang up"),
			answer: { outcome: "unknown", signature: SIGNATURE, because: "nothing known" },
		});

		const result = await submitOnce(setup.ports, proposal());

		expect(result).toMatchObject({ done: "unresolved" });
		expect(result).toMatchObject({ because: expect.stringContaining("socket hang up") });
	});

	it("reports it as never sent when the chain proves it expired", async () => {
		const setup = world({
			sendFails: new Error("connection refused"),
			answer: { outcome: "expired", signature: SIGNATURE },
		});

		expect(await submitOnce(setup.ports, proposal())).toMatchObject({ done: "never_sent" });
	});
});

describe("a signer that crashes and comes back", () => {
	it("records the real outcome without sending anything again", async () => {
		// The first attempt signs, writes the signature down, sends, and dies before hearing back.
		const first = world({ sendFails: new Error("the process died") });
		const request = proposal();
		await submitOnce(first.ports, request).catch(() => undefined);

		expect(first.recorded).toHaveLength(1);

		// Starting again, the record already has a signature for this trade.
		const second = world({
			existing: first.recorded[0] as Submission,
			answer: landed,
		});

		const result = await submitOnce(second.ports, request);

		expect(result).toMatchObject({ done: "landed", signature: SIGNATURE });
		expect(second.signings).toBe(0);
		expect(second.sent).toHaveLength(0);
	});
});
