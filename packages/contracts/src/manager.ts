/**
 * The manager: an owner's own AI, run on their own key.
 *
 * The key goes in once and never comes back out. All the app ever sees is whether one is set and its
 * last four characters, so a stolen session can use the manager but cannot take the key away with it.
 */

import { z } from "zod";

export const ManagerKeyStatus = z
	.strictObject({
		set: z.boolean(),
		/** The key's last four characters, so you can tell which one is in. */
		hint: z.string().optional(),
		setAt: z.iso.datetime().optional(),
	})
	.meta({ id: "ManagerKeyStatus" });
export type ManagerKeyStatus = z.infer<typeof ManagerKeyStatus>;

export const SetManagerKeyRequest = z
	.strictObject({
		key: z
			.string()
			.trim()
			.regex(/^sk-ant-[A-Za-z0-9_-]{20,200}$/, "that does not look like an Anthropic key"),
	})
	.meta({ id: "SetManagerKeyRequest" });
export type SetManagerKeyRequest = z.infer<typeof SetManagerKeyRequest>;

/**
 * A conversation with the manager, sent whole each turn. The app keeps it; the gateway keeps nothing
 * between turns, so there is no copy of what you said anywhere you did not put it.
 */
export const ManagerMessageRequest = z
	.strictObject({
		messages: z
			.array(
				z.strictObject({
					role: z.enum(["you", "manager"]),
					text: z.string().trim().min(1).max(8_000),
				}),
			)
			.min(1)
			.max(60)
			.refine((messages) => messages.at(-1)?.role === "you", "the last message must be yours"),
	})
	.meta({ id: "ManagerMessageRequest" });
export type ManagerMessageRequest = z.infer<typeof ManagerMessageRequest>;

export const ManagerMessageResponse = z
	.strictObject({
		reply: z.string(),
		/** What this answer cost on your key, in dollars. */
		costUsd: z.number().nonnegative(),
		/** What it looked at to answer, so you can see how it got there. */
		looked: z.array(z.strictObject({ tool: z.string(), ok: z.boolean() })),
	})
	.meta({ id: "ManagerMessageResponse" });
export type ManagerMessageResponse = z.infer<typeof ManagerMessageResponse>;
