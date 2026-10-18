import { z } from "zod";

/**
 * The public record: what the machines actually did, for anyone, with no sign-in.
 *
 * Amounts are whole base units as text (USDC has six decimals, SOL nine), so no float ever touches
 * them. Every shape here is strict, so a field added by mistake fails the response instead of leaking.
 */

const at = z.iso.datetime();
const side = z.enum(["buy", "sell"]);
const amount = z.string().regex(/^\d+$/);

/**
 * One finished trade with real money: when, which way, how much, and the signature that proves it on
 * the chain. Nothing about the machine or its owner is here.
 */
export const PublicTrade = z
	.strictObject({ at, side, usdc: amount, sol: amount, signature: z.string().min(1) })
	.meta({ id: "PublicTrade" });
export type PublicTrade = z.infer<typeof PublicTrade>;

/**
 * One trade a machine on paper would have made.
 *
 * **It has no signature, and that is the point.** A paper machine signs nothing, so there is nothing
 * to link to and nothing to verify on the chain. Leaving the field out rather than blanking it means
 * a page cannot render an explorer link for a trade that never happened, however it is written: the
 * data to do it does not exist.
 */
export const PaperTrade = z
	.strictObject({ at, side, usdc: amount, sol: amount })
	.meta({ id: "PaperTrade" });
export type PaperTrade = z.infer<typeof PaperTrade>;

/**
 * One action a machine proposed and was not allowed to take.
 *
 * This is the part of the record that is worth more than the trades. Anybody can show you what their
 * software did; this shows what it tried to do and was stopped from doing, which is the only
 * evidence that the limits are real rather than described.
 *
 * `by` says which of the two independent gates refused it: Maschina's own rules, or the wallet
 * provider's policy, which refuses on its own and does not take Maschina's word for anything.
 * `rule` is a code from a closed set, never a sentence. The reason written in the record is free
 * text and stays private, because free text is how an owner's strategy, balances and mistakes leak
 * out one sentence at a time.
 */
export const PublicRefusal = z
	.strictObject({
		at,
		side,
		usdc: amount,
		sol: amount,
		by: z.enum(["maschina", "provider"]),
		rule: z.enum([
			"budget",
			"derived_mismatch",
			"halted",
			"provider_policy",
			"recipients",
			"simulation_failed",
			"transaction_shape",
			"unknown_machine",
			"unknown_wallet",
		]),
	})
	.meta({ id: "PublicRefusal" });
export type PublicRefusal = z.infer<typeof PublicRefusal>;

/**
 * Real money and paper, kept apart.
 *
 * Two lists rather than one list with a label, because D-096 says no total, chart or figure ever adds
 * a paper number to a live one, and a label is something a caller has to remember to read. Two lists
 * make adding them together a deliberate act instead of an oversight.
 */
export const PublicRecord = z
	.strictObject({
		live: z.array(PublicTrade),
		paper: z.array(PaperTrade),
		/**
		 * What was proposed and refused, real money and paper alike. One list rather than two,
		 * because a refusal costs nothing and moves nothing: there is no number here that could be
		 * added to a live one, which is the thing D-096 exists to prevent.
		 */
		refused: z.array(PublicRefusal),
	})
	.meta({ id: "PublicRecord" });
export type PublicRecord = z.infer<typeof PublicRecord>;
