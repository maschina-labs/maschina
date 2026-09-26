/**
 * What the orchestrator may ask the signer to do, and what it gets back.
 *
 * This is the narrowest interface in Maschina and the most dangerous one, because on the other side of
 * it is the only thing that can move money. So the request says everything needed to judge the trade and
 * nothing else: no instructions, no options, no flags that change how the signer behaves. The signer
 * decides, the caller only asks.
 *
 * Unknown fields are refused rather than ignored. A field the signer does not understand is a field
 * somebody expected it to act on.
 */

import { z } from "zod";

const id = z
	.string()
	.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, "not a v7 id");

const base58 = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "not base58");
const address = base58.min(32).max(44);
const signature = base58.min(64).max(88);

/** A whole number too large for JSON, carried as digits. */
const whole = z.string().regex(/^\d+$/, "not a whole number");

/**
 * A Solana transaction is at most 1232 bytes on the wire, which is about 1644 base64 characters. A
 * little room is left for encoding, and anything beyond that could never be sent anyway.
 */
const transaction = z
	.string()
	.min(1)
	.max(2000)
	.regex(/^[A-Za-z0-9+/]+={0,2}$/, "not base64");

/** The trade being proposed, in the terms the record already uses. */
export const ProposedTrade = z
	.strictObject({
		inputMint: address,
		outputMint: address,
		inputAmount: whole,
		/** What the router expects the trade to produce. */
		quotedOutputAmount: whole,
		/** The least it may produce. This is the number the rules judge. */
		minimumOutputAmount: whole,
		slippageBps: z.int().min(0).max(10_000),
		router: z.string().min(1).max(40),
	})
	.meta({ id: "ProposedTrade" });
export type ProposedTrade = z.infer<typeof ProposedTrade>;

export const SignRequest = z
	.strictObject({
		/** Identifies this proposal. The same proposal may arrive twice and must act once. */
		proposalId: id,
		runId: id,
		tradeId: id,
		machineId: id,
		/** The machine's wallet: the only account the signer will ever sign for. */
		wallet: address,
		transaction,
		/** The height after which this transaction can never land. */
		lastValidBlockHeight: whole,
		trade: ProposedTrade,
	})
	.meta({ id: "SignRequest" });
export type SignRequest = z.infer<typeof SignRequest>;

/**
 * What a machine on paper proposes.
 *
 * The same trade, minus the transaction, because there is nothing to sign and nothing to land. The
 * shape is the guarantee: a paper run cannot reach the signer by mistake, because it never has the one
 * thing the signer needs.
 */
export const SimulateRequest = z
	.strictObject({
		proposalId: id,
		runId: id,
		tradeId: id,
		machineId: id,
		wallet: address,
		trade: ProposedTrade,
	})
	.meta({ id: "SimulateRequest" });
export type SimulateRequest = z.infer<typeof SimulateRequest>;

/**
 * An owner asking for a machine's funds back.
 *
 * Deliberately says almost nothing. It names the machine and an amount, and that is all, because
 * everything else is either derived or refused. The destination is not in here on purpose: the signer
 * looks up who owns the machine and pays them. A destination that travelled with the request would be a
 * destination somebody could change, and the one promise this whole system makes is that a machine's
 * funds reach its owner and nowhere else.
 */
export const WithdrawRequest = z
	.strictObject({
		/** Identifies this withdrawal. The same one may arrive twice and must move money once. */
		withdrawalId: id,
		machineId: id,
		lamports: whole,
	})
	.meta({ id: "WithdrawRequest" });
export type WithdrawRequest = z.infer<typeof WithdrawRequest>;

/**
 * What came back from a withdrawal.
 *
 * A refusal is a normal answer here too: an amount larger than the wallet holds, or a machine nobody
 * owns, is the system working.
 */
export const WithdrawResponse = z
	.discriminatedUnion("status", [
		z.strictObject({
			status: z.literal("sent"),
			withdrawalId: id,
			signature,
			/** Where it went, echoed back so an owner can check it against their own wallet. */
			to: address,
			lamports: whole,
		}),
		z.strictObject({
			status: z.literal("refused"),
			withdrawalId: id,
			rule: z.string().min(1).max(100),
			reason: z.string().min(1).max(500),
		}),
	])
	.meta({ id: "WithdrawResponse" });
export type WithdrawResponse = z.infer<typeof WithdrawResponse>;

/**
 * What came back.
 *
 * A refusal is a normal answer, not an error: Maschina's rules refusing a trade is the system working.
 * It carries the rule by name so the record says exactly what stopped it.
 *
 * A simulation is the third answer. A machine running on paper is priced and recorded exactly like a
 * real one, and then nothing is signed, so an owner can read what it would have done before it is
 * trusted with anything.
 */
export const SignResponse = z
	.discriminatedUnion("status", [
		z.strictObject({
			status: z.literal("signed"),
			proposalId: id,
			signature,
		}),
		z.strictObject({
			/** A machine on paper: the trade was priced and recorded, and nothing was signed. */
			status: z.literal("simulated"),
			proposalId: id,
			tradeId: id,
		}),
		z.strictObject({
			status: z.literal("refused"),
			proposalId: id,
			by: z.enum(["maschina", "provider"]),
			rule: z.string().min(1).max(100),
			reason: z.string().min(1).max(500),
		}),
	])
	.meta({ id: "SignResponse" });
export type SignResponse = z.infer<typeof SignResponse>;
