import { z } from "zod";

/**
 * One finished trade, as the public sees it: when, which way, how much, and the signature that proves it on the
 * chain. Nothing else about the machine or its owner is here, and the schema is strict, so a field added by
 * mistake fails the response instead of leaking. Amounts are whole base units as text (USDC has six decimals,
 * SOL nine), so no float ever touches them.
 */
export const PublicTrade = z
	.strictObject({
		at: z.iso.datetime(),
		side: z.enum(["buy", "sell"]),
		usdc: z.string().regex(/^\d+$/),
		sol: z.string().regex(/^\d+$/),
		signature: z.string().min(1),
	})
	.meta({ id: "PublicTrade" });
export type PublicTrade = z.infer<typeof PublicTrade>;

export const PublicRecord = z
	.strictObject({ trades: z.array(PublicTrade) })
	.meta({ id: "PublicRecord" });
export type PublicRecord = z.infer<typeof PublicRecord>;
