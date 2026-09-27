/**
 * Moving a machine's profit into its vault.
 *
 * The request names the machine and nothing else. Everything that decides what moves is worked out
 * here, at the moment of asking, and nothing is taken on trust:
 *
 *   look up the machine and its vault  ->  read what it holds from the chain  ->  work out its float
 *   ->  write the decision down  ->  build  ->  check the bytes  ->  sign, send once
 *
 * Most of the time nothing is due, because the machine is below its line, holding a position, or above
 * it by less than a transaction is worth. That answer writes nothing and signs nothing: a sweep that did
 * not happen is not an event.
 *
 * Racing a trade is safe by construction. A float carries any open position at what it cost, so a buy
 * landing between the read and the sweep leaves the float's value where it was. A sale needs a position,
 * and a machine holding one is not flat and is never swept.
 *
 * Sending happens through `submitOnce`, like a trade and a withdrawal, so a crash can never bank the
 * same profit twice and leave the float short. For the same reason a sweep the chain has not answered
 * is left open rather than written down as failed, and asking again with the same id finishes it from
 * the decision recorded at the time. Deciding again would be wrong exactly when it landed: the account
 * would be back on its line, nothing would look due, and the profit would be banked and never recorded.
 */

import type { SweepRequest, SweepResponse } from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import type { SweepDecision } from "@maschina/rules";
import {
	type Address,
	buildSweep,
	checkUnsignedSweep,
	type SweepRequest as SweepBuild,
} from "@maschina/solana";
import { type ChainAnswer, type Submission, submitOnce } from "./submit-once.ts";

/** A machine as a sweep needs to know it. */
type SweepingMachine = {
	/** The trading account: it holds the profit, pays the fee and signs. */
	wallet: Address;
	/** The vault beside it. Absent for a machine made before vaults, which never sweeps. */
	vault?: Address | undefined;
	providerWalletId: string;
	/** The currency the float is counted in. Absent when the machine's kind names none. */
	budgetMint?: Address | undefined;
	/** A machine on paper has a float made of quotes, not money. */
	paper: boolean;
};

export type SweepPorts = {
	machineFor(machineId: string): Promise<SweepingMachine | undefined>;
	/** What the trading account holds of the budget's currency, read from the chain. */
	holdingOf(wallet: Address, mint: Address): Promise<bigint>;
	/** The machine's float, worked out from its record around what the chain says it holds. */
	floatOf(
		machineId: string,
		holding: bigint,
	): Promise<{ target: bigint; value: bigint; sweep: SweepDecision }>;
	/** A mint's decimals, read from the chain. A checked transfer refuses the wrong number. */
	decimalsOf(mint: Address): Promise<number>;
	latestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: bigint }>;
	record(event: {
		machineId: string;
		type: "sweep.requested" | "sweep.submitted" | "sweep.completed" | "sweep.failed";
		payload: Record<string, unknown>;
	}): Promise<void>;
	/** The signature already written down for this sweep, when there is one. */
	submissionFor(machineId: string, sweepId: string): Promise<Submission | undefined>;
	/** What was decided when this sweep was asked for, when it was. */
	requestedFor(
		machineId: string,
		sweepId: string,
	): Promise<{ to: Address; mint: Address; amount: bigint } | undefined>;
	/** Signs as the machine's trading account. The vault never signs a sweep; it only receives. */
	sign(providerWalletId: string, transaction: Uint8Array): Promise<Uint8Array>;
	signatureOf(signedTransaction: Uint8Array): string;
	send(signedTransaction: Uint8Array): Promise<void>;
	confirm(submission: Submission): Promise<ChainAnswer>;
	/** What it cost to send, read back off the chain. */
	costOf(signature: string): Promise<bigint>;
	/** Builds the sweep. A port so the check after it can be proved to catch a bad build. */
	build?(sweep: SweepBuild): Promise<Uint8Array>;
};

const refused = (sweepId: string, rule: string, reason: string): SweepResponse => ({
	status: "refused",
	sweepId,
	rule,
	reason,
});

export async function sweepProfit(
	ports: SweepPorts,
	request: SweepRequest,
): Promise<SweepResponse> {
	const machine = await ports.machineFor(request.machineId);
	if (!machine) {
		return refused(request.sweepId, "unknown_machine", "no machine by that id");
	}
	if (machine.paper) {
		return refused(request.sweepId, "paper", "a machine on paper has no money to bank");
	}
	if (!machine.vault) {
		return refused(
			request.sweepId,
			"no_vault",
			"this machine was made before vaults, and has nowhere to bank",
		);
	}
	if (!machine.budgetMint) {
		return refused(
			request.sweepId,
			"no_float",
			"this machine's budget has no currency to measure a float in",
		);
	}
	const { vault, budgetMint: mint } = machine;

	// A sweep that was already signed is finished, never decided again.
	const sent = await ports.submissionFor(request.machineId, request.sweepId);
	if (sent) {
		const decided = await ports.requestedFor(request.machineId, request.sweepId);
		if (!decided) {
			return refused(request.sweepId, "unknown_sweep", "a signature with no decision behind it");
		}
		return finish(
			ports,
			request,
			machine.providerWalletId,
			decided,
			undefined,
			sent.lastValidBlockHeight,
		);
	}

	// Measured, not inferred: the chain says what the account holds, and the record says the rest.
	const holding = await ports.holdingOf(machine.wallet, mint);
	const float = await ports.floatOf(request.machineId, holding);
	if (!float.sweep.sweep) {
		return { status: "not_due", sweepId: request.sweepId, because: float.sweep.because };
	}
	const decided = { to: vault, mint, amount: float.sweep.amount };

	// Written before anything is built, with the numbers it was decided from, so a crash leaves a
	// decision in the record rather than a signature nobody can explain.
	await ports.record({
		machineId: request.machineId,
		type: "sweep.requested",
		payload: {
			sweepId: request.sweepId,
			to: vault,
			mint,
			amount: decided.amount.toString(),
			value: float.value.toString(),
			floatTarget: float.target.toString(),
		},
	});

	const { blockhash, lastValidBlockHeight } = await ports.latestBlockhash();
	let transaction: Uint8Array;
	try {
		transaction = await (ports.build ?? buildSweep)({
			wallet: machine.wallet,
			vault,
			mint,
			decimals: await ports.decimalsOf(mint),
			amount: decided.amount,
			blockhash,
			lastValidBlockHeight,
		});
		await checkUnsignedSweep(transaction, {
			wallet: machine.wallet,
			vault,
			mint,
			amount: decided.amount,
		});
	} catch (error) {
		const reason = (error instanceof Error ? error.message : "the sweep could not be built").slice(
			0,
			500,
		);
		await ports.record({
			machineId: request.machineId,
			type: "sweep.failed",
			payload: { sweepId: request.sweepId, reason },
		});
		return refused(request.sweepId, "bad_transaction", reason);
	}

	return finish(
		ports,
		request,
		machine.providerWalletId,
		decided,
		transaction,
		lastValidBlockHeight,
	);
}

/** Signs and sends once, or asks the chain about what was already sent, and writes down how it ended. */
async function finish(
	ports: SweepPorts,
	request: SweepRequest,
	providerWalletId: string,
	decided: { to: Address; mint: Address; amount: bigint },
	transaction: Uint8Array | undefined,
	lastValidBlockHeight: bigint,
): Promise<SweepResponse> {
	const written = {
		machineId: request.machineId,
		payload: {
			sweepId: request.sweepId,
			to: decided.to,
			mint: decided.mint,
			amount: decided.amount.toString(),
		},
	};

	const result = await submitOnce(
		{
			submissionFor: (asked) => ports.submissionFor(asked.machineId, asked.sweepId),
			// The signature goes into the record before anything is sent.
			recordSubmission: (asked, submission) =>
				ports.record({
					machineId: asked.machineId,
					type: "sweep.submitted",
					payload: {
						sweepId: asked.sweepId,
						signature: submission.signature,
						lastValidBlockHeight: submission.lastValidBlockHeight.toString(),
					},
				}),
			sign: async () => {
				// Only reached when nothing was sent yet, which is exactly when a transaction was built.
				if (!transaction)
					throw new MaschinaError("internal", "asked to sign a sweep that was never built");
				return ports.sign(providerWalletId, transaction);
			},
			signatureOf: ports.signatureOf,
			send: ports.send,
			waitFor: (_asked, submission) => ports.confirm(submission),
			askChain: (_asked, submission) => ports.confirm(submission),
		},
		{ ...request, lastValidBlockHeight: lastValidBlockHeight.toString() },
	);

	if (result.done === "landed") {
		await ports.record({
			...written,
			type: "sweep.completed",
			payload: {
				...written.payload,
				signature: result.signature,
				feeLamports: (await ports.costOf(result.signature)).toString(),
				slot: result.slot.toString(),
			},
		});
		return {
			status: "swept",
			sweepId: request.sweepId,
			signature: result.signature,
			to: decided.to,
			mint: decided.mint,
			amount: decided.amount.toString(),
		};
	}

	const why = (
		result.done === "failed"
			? result.reason
			: result.done === "never_sent"
				? "it expired without reaching the chain"
				: result.because
	).slice(0, 500);

	// Unresolved is not failed. It stays open, and asking again with the same id finishes it.
	if (result.done === "unresolved") {
		throw new MaschinaError("unavailable", `the chain has not answered yet: ${why}`, {
			details: { sweepId: request.sweepId, signature: result.signature },
		});
	}

	await ports.record({
		...written,
		type: "sweep.failed",
		payload: { sweepId: request.sweepId, reason: why, signature: result.signature },
	});
	return refused(request.sweepId, "not_landed", why);
}
