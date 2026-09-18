/**
 * Sending a trade at most once, ever.
 *
 * This is the last place a crash can cost real money, and the only defence is the order things happen
 * in. A transaction's signature is decided the moment it is signed, before anything is sent, so the
 * signature is written to the record first and the transaction goes out second. That gives a crash
 * between them a name to ask the chain about, rather than a question nobody can answer.
 *
 *   sign  ->  write down the signature  ->  send  ->  ask the chain  ->  record the outcome
 *
 * A trade that already has a signature in the record is never signed again. Not "probably did not
 * land", not "it has been a while": never. The only thing that decides what happened to it is the
 * chain, and until the chain answers, the trade stays unfinished rather than being retried.
 *
 * The dangerous failure this prevents is not losing a trade. It is making the same one twice.
 */

import type { SignRequest } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";

export type Submission = {
	signature: string;
	lastValidBlockHeight: bigint;
};

/** What the chain said about a signature. */
export type ChainAnswer =
	| { outcome: "landed"; signature: string; slot: bigint }
	| { outcome: "failed"; signature: string; reason: string }
	| { outcome: "expired"; signature: string }
	| { outcome: "unknown"; signature: string; because: string };

export type SubmitPorts = {
	/** The signature already written down for this trade, when there is one. */
	submissionFor(request: SignRequest): Promise<Submission | undefined>;
	/** Signs, without sending. The signature exists from this moment. */
	sign(request: SignRequest): Promise<Uint8Array>;
	/** Reads the signature out of signed bytes, before anything is sent. */
	signatureOf(signedTransaction: Uint8Array): string;
	/** Writes the signature down. Nothing is sent until this has happened. */
	recordSubmission(request: SignRequest, submission: Submission): Promise<void>;
	/** Sends it. */
	send(signedTransaction: Uint8Array): Promise<void>;
	/** Waits for the chain to say what happened. */
	waitFor(request: SignRequest, submission: Submission): Promise<ChainAnswer>;
	/** Asks the chain about a signature from a run that did not finish. */
	askChain(request: SignRequest, submission: Submission): Promise<ChainAnswer>;
};

export type SubmitResult =
	| { done: "landed"; signature: string; slot: bigint }
	| { done: "failed"; signature: string; reason: string }
	| { done: "never_sent"; signature: string }
	| { done: "unresolved"; signature: string; because: string };

/**
 * Signs, sends and finds out what happened, at most once per trade.
 *
 * Called again for a trade that already went out, it sends nothing and asks the chain instead. That is
 * true whether the first attempt crashed one line after signing or an hour ago.
 */
export async function submitOnce(ports: SubmitPorts, request: SignRequest): Promise<SubmitResult> {
	const already = await ports.submissionFor(request);
	if (already) {
		// Somebody already signed this trade. Whatever happened next, signing it again would risk a
		// second one landing, and no amount of waiting makes that safe.
		return answerToResult(await ports.askChain(request, already));
	}

	const signed = await ports.sign(request);
	const signature = ports.signatureOf(signed);
	const submission: Submission = {
		signature,
		lastValidBlockHeight: BigInt(request.lastValidBlockHeight),
	};

	// Written before sending, on purpose. A failure here means nothing was sent, which is recoverable.
	// The other order means something was sent that nothing knows about, which is not.
	await ports.recordSubmission(request, submission);

	try {
		await ports.send(signed);
	} catch (error) {
		// Sending failed, and "failed" from an RPC node does not mean "did not arrive". The transaction
		// may be in a queue somewhere. So this asks the chain rather than deciding for it.
		const asked = await ports.askChain(request, submission);
		if (asked.outcome === "unknown") {
			return {
				done: "unresolved",
				signature,
				because: `sending failed and the chain has no answer yet: ${message(error)}`,
			};
		}
		return answerToResult(asked);
	}

	return answerToResult(await ports.waitFor(request, submission));
}

function answerToResult(answer: ChainAnswer): SubmitResult {
	switch (answer.outcome) {
		case "landed":
			return { done: "landed", signature: answer.signature, slot: answer.slot };
		case "failed":
			return { done: "failed", signature: answer.signature, reason: answer.reason };
		case "expired":
			// The only way a trade is ever declared not to have happened: its own expiry has passed and
			// the chain has never heard of it. Nothing else counts, however long it has been.
			return { done: "never_sent", signature: answer.signature };
		case "unknown":
			return { done: "unresolved", signature: answer.signature, because: answer.because };
	}
}

const message = (error: unknown) =>
	error instanceof MaschinaError || error instanceof Error ? error.message : String(error);
