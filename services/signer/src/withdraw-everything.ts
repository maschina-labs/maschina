/**
 * Everything a machine holds, back to its owner.
 *
 * The request names the machine and nothing else. What is in it is read from the chain at the moment of
 * asking, and where it goes is the owner recorded against the machine. In order:
 *
 *   the vault's tokens       paid for by the trading account, signed by both, the vault only for its own
 *   the trading account's    every token, and every emptied account closed so its rent comes home too
 *   the SOL                  every lamport but the one fee sending it costs, through the proven transfer
 *
 * The vault goes first because it never holds SOL: the trading account pays for it while it still can.
 *
 * Each transaction is written down before it is signed, checked byte by byte against what was read, and
 * sent at most once. Nothing is left behind quietly. A token account its issuer has frozen cannot be
 * moved or closed, and the answer says so, with the amount.
 *
 * Asking again is safe. Every balance is read afresh, and every destination is the owner, so the most a
 * repeated request can do is try to move something that has already gone and be told it is not there.
 */

import type {
	WithdrawEverythingRequest,
	WithdrawEverythingResponse,
	WithdrawRequest,
	WithdrawResponse,
} from "@maschina/contracts";
import { MaschinaError } from "@maschina/core";
import {
	type Address,
	buildTokenWithdrawal,
	checkUnsignedTokenWithdrawal,
	type TokenWithdrawal,
	type WithdrawnToken,
} from "@maschina/solana";
import { type ChainAnswer, type Submission, submitOnce } from "./submit-once.ts";

/** What a plain transfer out of the trading account costs: one signature, no priority. */
const TRANSFER_FEE_LAMPORTS = 5_000n;

type Account = "trading" | "vault";

type EmptyingMachine = {
	wallet: Address;
	vault?: Address | undefined;
	ownerWallet: Address;
	providerWalletId: string;
};

type HeldToken = WithdrawnToken & { frozen: boolean };

export type WithdrawEverythingPorts = {
	machineFor(machineId: string): Promise<EmptyingMachine | undefined>;
	/** Every token account an address owns, empty ones included, read from the chain. */
	tokensOf(account: Address): Promise<HeldToken[]>;
	lamportsOf(account: Address): Promise<bigint>;
	latestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: bigint }>;
	record(event: {
		machineId: string;
		type:
			| "withdrawal.requested"
			| "withdrawal.submitted"
			| "withdrawal.completed"
			| "withdrawal.failed";
		payload: Record<string, unknown>;
	}): Promise<void>;
	submissionFor(machineId: string, withdrawalId: string): Promise<Submission | undefined>;
	/** Signs as one of the machine's accounts. */
	sign(providerWalletId: string, transaction: Uint8Array, account: Account): Promise<Uint8Array>;
	signatureOf(signedTransaction: Uint8Array): string;
	send(signedTransaction: Uint8Array): Promise<void>;
	confirm(submission: Submission): Promise<ChainAnswer>;
	costOf(signature: string): Promise<bigint>;
	/** A fresh id for each transaction, so each is recorded and sent once under its own name. */
	newId(): string;
	/** The SOL, through the withdrawal already proven on chain. */
	withdrawSol(request: WithdrawRequest): Promise<WithdrawResponse>;
	/** Builds a token withdrawal. A port so the check after it can be proved to catch a bad build. */
	build?(withdrawal: TokenWithdrawal): Promise<Uint8Array>;
};

type Sent = Extract<WithdrawEverythingResponse, { status: "sent" }>;

type Refused = Extract<WithdrawEverythingResponse, { status: "refused" }>;

const refused = (withdrawalId: string, rule: string, reason: string): Refused => ({
	status: "refused",
	withdrawalId,
	rule,
	reason: reason.slice(0, 500),
});

export async function withdrawEverything(
	ports: WithdrawEverythingPorts,
	request: WithdrawEverythingRequest,
): Promise<WithdrawEverythingResponse> {
	const machine = await ports.machineFor(request.machineId);
	if (!machine)
		return refused(request.withdrawalId, "unknown_machine", "no machine by that id has an owner");
	if (machine.ownerWallet === machine.wallet || machine.ownerWallet === machine.vault) {
		return refused(
			request.withdrawalId,
			"owner_is_machine",
			"the owner is recorded as the machine itself",
		);
	}

	const answer: Sent = {
		status: "sent",
		withdrawalId: request.withdrawalId,
		to: machine.ownerWallet,
		signatures: [],
		tokens: [],
		lamports: "0",
		leftBehind: [],
	};

	const accounts: [Account, Address][] = machine.vault
		? [
				["vault", machine.vault],
				["trading", machine.wallet],
			]
		: [["trading", machine.wallet]];

	for (const [from, address] of accounts) {
		const held = await ports.tokensOf(address);
		for (const token of held.filter((t) => t.frozen)) {
			answer.leftBehind.push({
				mint: token.mint,
				amount: token.amount.toString(),
				from,
				because: "frozen by the token's issuer",
			});
		}
		const movable = held.filter((t) => !t.frozen);
		if (movable.length === 0) continue;

		const step = await sendTokensHome(ports, request, machine, from, address, movable);
		if (step.status === "refused") return step;
		answer.signatures.push(step.signature);
		for (const token of movable) {
			if (token.amount > 0n)
				answer.tokens.push({ mint: token.mint, amount: token.amount.toString(), from });
		}
	}

	// Last, so everything above was paid for first. What is left, less the fee for sending it, goes home.
	const lamports = await ports.lamportsOf(machine.wallet);
	if (lamports > TRANSFER_FEE_LAMPORTS) {
		const sol = await ports.withdrawSol({
			withdrawalId: ports.newId(),
			machineId: request.machineId,
			lamports: (lamports - TRANSFER_FEE_LAMPORTS).toString(),
		});
		if (sol.status === "refused") {
			return refused(
				request.withdrawalId,
				sol.rule,
				`the tokens went home and the SOL did not: ${sol.reason}`,
			);
		}
		answer.signatures.push(sol.signature);
		answer.lamports = sol.lamports;
	}

	return answer;
}

/** One account's tokens, as one transaction: written down, built, checked, signed, sent once. */
async function sendTokensHome(
	ports: WithdrawEverythingPorts,
	request: WithdrawEverythingRequest,
	machine: EmptyingMachine,
	from: Account,
	address: Address,
	tokens: HeldToken[],
): Promise<
	{ status: "sent"; signature: string } | Extract<WithdrawEverythingResponse, { status: "refused" }>
> {
	const stepId = ports.newId();
	const recorded = tokens
		.filter((token) => token.amount > 0n)
		.map((token) => ({ mint: token.mint, amount: token.amount.toString(), from }));
	const payload = {
		withdrawalId: stepId,
		to: machine.ownerWallet,
		lamports: "0",
		...(recorded.length > 0 ? { tokens: recorded } : {}),
	};
	await ports.record({ machineId: request.machineId, type: "withdrawal.requested", payload });

	const { blockhash, lastValidBlockHeight } = await ports.latestBlockhash();
	const withdrawal: TokenWithdrawal = {
		payer: machine.wallet,
		from: address,
		owner: machine.ownerWallet,
		tokens: tokens.map(({ frozen: _frozen, ...token }) => token),
		blockhash,
		lastValidBlockHeight,
	};

	let transaction: Uint8Array;
	try {
		transaction = await (ports.build ?? buildTokenWithdrawal)(withdrawal);
		await checkUnsignedTokenWithdrawal(transaction, withdrawal);
	} catch (error) {
		const reason = (
			error instanceof Error ? error.message : "the withdrawal could not be built"
		).slice(0, 500);
		await ports.record({
			machineId: request.machineId,
			type: "withdrawal.failed",
			payload: { withdrawalId: stepId, reason },
		});
		return refused(request.withdrawalId, "bad_transaction", reason);
	}

	const result = await submitOnce(
		{
			submissionFor: (asked) => ports.submissionFor(asked.machineId, asked.withdrawalId),
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
			sign: async () => {
				// The trading account pays, so it signs first. The vault signs only for its own tokens.
				const paid = await ports.sign(machine.providerWalletId, transaction, "trading");
				return from === "vault" ? ports.sign(machine.providerWalletId, paid, "vault") : paid;
			},
			signatureOf: ports.signatureOf,
			send: ports.send,
			waitFor: (_asked, submission) => ports.confirm(submission),
			askChain: (_asked, submission) => ports.confirm(submission),
		},
		{
			withdrawalId: stepId,
			machineId: request.machineId,
			lastValidBlockHeight: lastValidBlockHeight.toString(),
		},
	);

	if (result.done === "landed") {
		await ports.record({
			machineId: request.machineId,
			type: "withdrawal.completed",
			payload: {
				...payload,
				signature: result.signature,
				feeLamports: (await ports.costOf(result.signature)).toString(),
				slot: result.slot.toString(),
			},
		});
		return { status: "sent", signature: result.signature };
	}

	const why = (
		result.done === "failed"
			? result.reason
			: result.done === "never_sent"
				? "it expired without reaching the chain"
				: result.because
	).slice(0, 500);
	if (result.done === "unresolved") {
		// Not failed. It may still land; asking again reads the balances afresh.
		throw new MaschinaError("unavailable", `the chain has not answered yet: ${why}`, {
			details: { withdrawalId: stepId, signature: result.signature },
		});
	}
	await ports.record({
		machineId: request.machineId,
		type: "withdrawal.failed",
		payload: { withdrawalId: stepId, reason: why, signature: result.signature },
	});
	return refused(request.withdrawalId, "not_landed", why);
}
