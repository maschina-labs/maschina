/**
 * What the orchestrator tells the bots about: events in the record worth telling an owner.
 *
 * The bots never read the database (they are an adapter over the services), so everything a message
 * needs comes with the alert: which machine, what happened, and for a trade, which way it went and what
 * the machine has realised so far. Amounts stay in each token's smallest unit, as everywhere else.
 */

import { z } from "zod";

const address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "not an address");
const whole = z.string().regex(/^\d+$/, "not a whole number");
/** Profit so far can be a loss, so unlike every other amount it may be negative. */
const signed = z.string().regex(/^-?\d+$/, "not a whole number");

export const ALERT_CHANNELS = ["telegram"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const Alert = z
	.strictObject({
		eventId: z.string(),
		ownerId: z.string(),
		machineId: z.string(),
		machineName: z.string(),
		type: z.string(),
		occurredAt: z.iso.datetime(),
		/** A completed trade: what went in and what came out, in the tokens' smallest units. */
		trade: z
			.strictObject({
				inputMint: address,
				outputMint: address,
				inputAmount: whole,
				outputAmount: whole,
			})
			.optional(),
		/** What the machine has realised in total, in the token its budget is counted in. */
		realised: signed.optional(),
		/** Why, for a failure, a refusal or a machine that paused itself. */
		reason: z.string().optional(),
	})
	.meta({ id: "Alert" });
export type Alert = z.infer<typeof Alert>;

export const PendingAlerts = z
	.strictObject({ alerts: z.array(Alert) })
	.meta({ id: "PendingAlerts" });
export type PendingAlerts = z.infer<typeof PendingAlerts>;

export const AlertDelivered = z
	.strictObject({ eventId: z.string(), channel: z.enum(ALERT_CHANNELS) })
	.meta({ id: "AlertDelivered" });
export type AlertDelivered = z.infer<typeof AlertDelivered>;
