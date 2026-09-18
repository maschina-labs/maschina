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
 * What came back.
 *
 * A refusal is a normal answer, not an error: Maschina's rules refusing a trade is the system working.
 * It carries the rule by name so the record says exactly what stopped it.
 */
export const SignResponse = z
	.discriminatedUnion("status", [
		z.strictObject({
			status: z.literal("signed"),
			proposalId: id,
			signature,
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
