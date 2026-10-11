import { z } from "zod";

/** Who a message is for. Each is a role address at maschina.dev, never a person's. Security has its own page. */
export const CONTACT_TOPICS = ["support", "billing", "legal", "abuse"] as const;

/**
 * A message from the contact page. The name goes into a mail subject, so it may not carry a line break: that is how
 * a header is smuggled into a mail. `website` is a field a person never sees and never fills; a program that fills
 * every field does, and its message is dropped.
 */
export const ContactMessage = z
	.strictObject({
		topic: z.enum(CONTACT_TOPICS),
		name: z
			.string()
			.trim()
			.min(1)
			.max(100)
			.regex(/^[^\r\n]+$/, "no line breaks"),
		email: z.email().max(200),
		message: z.string().trim().min(10).max(5000),
		website: z.string().max(200).optional(),
	})
	.meta({ id: "ContactMessage" });
export type ContactMessage = z.infer<typeof ContactMessage>;

export const ContactReceipt = z
	.strictObject({ sent: z.literal(true) })
	.meta({ id: "ContactReceipt" });
export type ContactReceipt = z.infer<typeof ContactReceipt>;
