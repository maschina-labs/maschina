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
 * Real money and paper, kept apart.
 *
 * Two lists rather than one list with a label, because D-096 says no total, chart or figure ever adds
 * a paper number to a live one, and a label is something a caller has to remember to read. Two lists
 * make adding them together a deliberate act instead of an oversight.
 */
export const PublicRecord = z
	.strictObject({ live: z.array(PublicTrade), paper: z.array(PaperTrade) })
	.meta({ id: "PublicRecord" });
export type PublicRecord = z.infer<typeof PublicRecord>;
