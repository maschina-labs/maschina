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
