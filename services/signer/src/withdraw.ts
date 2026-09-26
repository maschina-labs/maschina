/**
 * Returning a machine's funds to its owner.
 *
 * The one movement in Maschina whose destination somebody chose, which makes it the one that has to be
 * proved rather than trusted. So the request says only which machine and how much: the signer looks up
 * who owns the machine and pays them. A destination carried in the request would be a destination
 * somebody could change.
 *
 * The order is the same as a trade's, for the same reason:
 *
 *   look up the owner  ->  write the request down  ->  build  ->  check the bytes  ->  sign, send once
 *
 * The check between building and signing is not a formality. It takes the transaction apart and refuses
 * it unless it is exactly one transfer, out of this machine's wallet, to this owner, for this amount.
 * Whatever built it, and however it was built, only bytes that match the request are ever signed.
 *
 * Sending happens through `submitOnce`, the same as a trade, so a crash can never pay an owner twice.
 */

import type { WithdrawRequest, WithdrawResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import {
	type Address,
	buildTransfer,
	checkUnsignedWithdrawal,
	type TransferRequest,
} from "@maschina/solana";
import { type ChainAnswer, type Submission, submitOnce } from "./submit-once.ts";

/** Who a machine belongs to, and which wallet the provider signs for. */
type WithdrawingMachine = {
	wallet: Address;
	/** The owner's own wallet. The only place these funds may go. */
	ownerWallet: Address;
	providerWalletId: string;
};

export type WithdrawPorts = {
	machineFor(machineId: string): Promise<WithdrawingMachine | undefined>;
	latestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: bigint }>;
	/** Writes to the record, the same way every other event is written. */
	record(event: {
		machineId: string;
		type:
			| "withdrawal.requested"
			| "withdrawal.submitted"
			| "withdrawal.completed"
			| "withdrawal.failed";
		payload: Record<string, unknown>;
	}): Promise<void>;
	/** The signature already written down for this withdrawal, when there is one. */
	submissionFor(machineId: string, withdrawalId: string): Promise<Submission | undefined>;
	sign(providerWalletId: string, transaction: Uint8Array): Promise<Uint8Array>;
	signatureOf(signedTransaction: Uint8Array): string;
	send(signedTransaction: Uint8Array): Promise<void>;
	confirm(submission: Submission): Promise<ChainAnswer>;
	/** What the transfer cost to send, read back off the chain. The owner paid it. */
	costOf(signature: string): Promise<bigint>;
	/** Builds the transfer. A port so the check above it can be proved to catch a bad build. */
	build?(transfer: TransferRequest): Uint8Array;
};

const refused = (
	withdrawalId: string,
	rule: string,
	reason: string,
): Extract<WithdrawResponse, { status: "refused" }> => ({
	status: "refused",
	withdrawalId,
	rule,
	reason,
});

export async function withdrawFunds(
	ports: WithdrawPorts,
	request: WithdrawRequest,
): Promise<WithdrawResponse> {
	const lamports = BigInt(request.lamports);
	if (lamports <= 0n) {
		return refused(request.withdrawalId, "invalid_amount", "a withdrawal moves more than nothing");
	}

	const machine = await ports.machineFor(request.machineId);
	if (!machine) {
		// Nothing is written for a machine that does not exist: there is no record to write it to.
		return refused(request.withdrawalId, "unknown_machine", "no machine by that id has an owner");
	}
	if (machine.wallet === machine.ownerWallet) {
		return refused(
			request.withdrawalId,
			"owner_is_machine",
			"this machine's wallet is recorded as its owner's, so there is nowhere to send funds",
		);
	}

	const written = {
		machineId: request.machineId,
		payload: {
			withdrawalId: request.withdrawalId,
			to: machine.ownerWallet,
			lamports: request.lamports,
		},
	};
	// Written before anything is built, so a crash leaves an asked-for withdrawal in the record rather
	// than a signature nobody asked for.
	await ports.record({ ...written, type: "withdrawal.requested" });

	const { blockhash, lastValidBlockHeight } = await ports.latestBlockhash();
	const transfer: TransferRequest = {
		from: machine.wallet,
		to: machine.ownerWallet,
		lamports,
		blockhash,
		lastValidBlockHeight,
	};

	let transaction: Uint8Array;
	try {
		transaction = (ports.build ?? buildTransfer)(transfer);
		checkUnsignedWithdrawal(transaction, {
			wallet: machine.wallet,
			to: machine.ownerWallet,
			lamports,
		});
	} catch (error) {
		const reason = error instanceof Error ? error.message : "the transfer could not be built";
		// A failure says what went wrong and nothing else. Where it would have gone and how much are in
		// the request already, and repeating them here would claim the transfer was attempted.
		await ports.record({
			...written,
			type: "withdrawal.failed",
			payload: { withdrawalId: request.withdrawalId, reason },
		});
		return refused(request.withdrawalId, "bad_transaction", reason);
	}

	const sending = { ...request, lastValidBlockHeight: lastValidBlockHeight.toString() };
	const result = await submitOnce(
		{
			submissionFor: (asked) => ports.submissionFor(asked.machineId, asked.withdrawalId),
			// The signature goes into the record like everything else, and before anything is sent.
			recordSubmission: (asked, submission) =>
				ports.record({
					machineId: asked.machineId,
					type: "withdrawal.submitted",
					payload: {
						withdrawalId: asked.withdrawalId,
						signature: submission.signature,
						lastValidBlockHeight: submission.lastValidBlockHeight.toString(),
					},
				}),
			sign: () => ports.sign(machine.providerWalletId, transaction),
			signatureOf: ports.signatureOf,
			send: ports.send,
			waitFor: (_asked, submission) => ports.confirm(submission),
			askChain: (_asked, submission) => ports.confirm(submission),
		},
		sending,
	);

	if (result.done === "landed") {
		await ports.record({
			...written,
			type: "withdrawal.completed",
			payload: {
				...written.payload,
				signature: result.signature,
				feeLamports: (await ports.costOf(result.signature)).toString(),
				slot: result.slot.toString(),
			},
		});
		return {
			status: "sent",
			withdrawalId: request.withdrawalId,
			signature: result.signature,
			to: machine.ownerWallet,
			lamports: request.lamports,
		};
	}

	const why =
		result.done === "failed"
			? result.reason
			: result.done === "never_sent"
				? "it expired without reaching the chain"
				: result.because;
	await ports.record({
		...written,
		type: "withdrawal.failed",
		payload: { withdrawalId: request.withdrawalId, reason: why, signature: result.signature },
	});
	// Unresolved is not the same as failed, and an owner is told which. The money may still move.
	if (result.done === "unresolved") {
		throw new MaschinaError("unavailable", `the chain has not answered yet: ${why}`, {
			details: { withdrawalId: request.withdrawalId, signature: result.signature },
		});
	}
	return refused(request.withdrawalId, "not_landed", why);
}
