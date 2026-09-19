/**
 * The innermost signer: the one that actually signs, sends and finds out what happened.
 *
 * By the time a request reaches here, Maschina's rules have allowed it and the budget holds its money.
 * This is the part that turns that into a transaction on chain and then squares the books:
 *
 *   check the shape  ->  sign (the provider can still refuse)  ->  send at most once  ->  ask the chain
 *     landed:           settle the budget at what the chain says it really cost
 *     failed, expired:  give the held money back, with the reason
 *     no answer yet:    leave it open, because only the chain can say, and guessing is how money is lost
 */

import type { SignRequest, SignResponse } from "@maschina/contracts";
import { toMaschinaError, type WalletProvider } from "./provider/wallet-provider.ts";
import type { TradeSigner } from "./sign-route.ts";
import { type ChainAnswer, type Submission, submitOnce } from "./submit-once.ts";

type TradeCost = { inputAmount: bigint; outputAmount: bigint; feeLamports: bigint };

export type ChainPorts = {
	/** Throws when the transaction is not a plain swap signed and paid for by the machine's wallet. */
	checkShape(transaction: Uint8Array, wallet: string): void;
	/** The machine's wallet at the provider, from the record. */
	walletIdFor(request: SignRequest): Promise<string | undefined>;
	provider: Pick<WalletProvider, "sign">;
	signatureOf(signedTransaction: Uint8Array): string;
	submissions: {
		submissionFor(request: SignRequest): Promise<Submission | undefined>;
		recordSubmission(request: SignRequest, submission: Submission): Promise<void>;
	};
	chain: {
		send(signedTransaction: Uint8Array): Promise<void>;
		/** Waits for the chain's answer about a signature, up to its expiry. */
		confirm(request: SignRequest, submission: Submission): Promise<ChainAnswer>;
		/** What a landed transaction cost the machine's wallet. */
		costOf(request: SignRequest, signature: string): Promise<TradeCost>;
	};
	outcomes: {
		settle(request: SignRequest, signature: string, cost: TradeCost): Promise<void>;
		release(
			request: SignRequest,
			stage: "submit" | "confirm",
			reason: string,
			signature: string,
		): Promise<void>;
		recordRefusal(
			request: SignRequest,
			refusal: { by: "maschina" | "provider"; rule: string; reason: string },
		): Promise<void>;
	};
};

/** Thrown out of signing when the provider says no, so nothing after it runs. */
class RefusedByProvider extends Error {}

const refused = (
	request: SignRequest,
	by: "maschina" | "provider",
	rule: string,
	reason: string,
): SignResponse => ({
	status: "refused",
	proposalId: request.proposalId,
	by,
	rule,
	reason: reason.slice(0, 500),
});

export function chainSigner(ports: ChainPorts): TradeSigner {
	return {
		async sign(request: SignRequest): Promise<SignResponse> {
			const transaction = new Uint8Array(Buffer.from(request.transaction, "base64"));

			try {
				ports.checkShape(transaction, request.wallet);
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error);
				await ports.outcomes.recordRefusal(request, {
					by: "maschina",
					rule: "transaction_shape",
					reason,
				});
				return refused(request, "maschina", "transaction_shape", reason);
			}

			const walletId = await ports.walletIdFor(request);
			if (!walletId) {
				const reason = "the machine has no wallet at the provider";
				await ports.outcomes.recordRefusal(request, {
					by: "maschina",
					rule: "unknown_wallet",
					reason,
				});
				return refused(request, "maschina", "unknown_wallet", reason);
			}

			let result: Awaited<ReturnType<typeof submitOnce>>;
			try {
				result = await submitOnce(
					{
						submissionFor: ports.submissions.submissionFor,
						recordSubmission: ports.submissions.recordSubmission,
						sign: async () => {
							const signed = await ports.provider.sign(walletId, transaction);
							if (signed.ok) return signed.value;
							if (signed.error.kind === "refused")
								throw new RefusedByProvider(signed.error.message);
							throw toMaschinaError(signed.error);
						},
						signatureOf: ports.signatureOf,
						send: ports.chain.send,
						waitFor: ports.chain.confirm,
						askChain: ports.chain.confirm,
					},
					request,
				);
			} catch (error) {
				if (!(error instanceof RefusedByProvider)) throw error;
				await ports.outcomes.recordRefusal(request, {
					by: "provider",
					rule: "provider_policy",
					reason: error.message,
				});
				return refused(request, "provider", "provider_policy", error.message);
			}

			switch (result.done) {
				case "landed":
					await ports.outcomes.settle(
						request,
						result.signature,
						await ports.chain.costOf(request, result.signature),
					);
					break;
				case "failed":
					await ports.outcomes.release(request, "submit", result.reason, result.signature);
					break;
				case "never_sent":
					await ports.outcomes.release(
						request,
						"confirm",
						"expired before it landed",
						result.signature,
					);
					break;
				case "unresolved":
					// The money stays held. Recovery asks the chain again later; nothing here guesses.
					break;
			}

			return { status: "signed", proposalId: request.proposalId, signature: result.signature };
		},
	};
}
