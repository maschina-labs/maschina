/**
 * The shapes that cross the network: what the gateway accepts and returns, and what the web app and
 * bots expect. Defined once, here, so both sides can't drift.
 */

import { z } from "zod";

export * from "./events.ts";

export const HealthResponse = z
	.object({
		status: z.enum(["ok", "degraded"]),
		service: z.string(),
		version: z.string(),
		time: z.iso.datetime(),
	})
	.meta({ id: "HealthResponse" });
export type HealthResponse = z.infer<typeof HealthResponse>;

export const ErrorBody = z
	.object({
		error: z.object({
			code: z.string(),
			message: z.string(),
			requestId: z.string(),
		}),
	})
	.meta({ id: "ErrorBody" });
export type ErrorBody = z.infer<typeof ErrorBody>;
