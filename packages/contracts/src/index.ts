/**
 * The shapes that cross the network: what the gateway accepts and returns, and what the web app and
 * bots expect. Defined once, here, so both sides can't drift.
 */

import { z } from "zod";

export * from "./events.ts";
export * from "./runs.ts";
export * from "./signing.ts";

export const HealthResponse = z
	.object({
		status: z.enum(["ok", "degraded"]),
		service: z.string(),
		version: z.string(),
		time: z.iso.datetime(),
	})
	.meta({ id: "HealthResponse" });
export type HealthResponse = z.infer<typeof HealthResponse>;

/**
 * The API's own status, and the stop switch: while a halt is in force nothing is signed for any machine,
 * though owners can still take their money out. Absent when no halt is in force.
 */
export const StatusResponse = HealthResponse.extend({
	halt: z.object({ reason: z.string(), since: z.iso.datetime() }).optional(),
}).meta({ id: "StatusResponse" });
export type StatusResponse = z.infer<typeof StatusResponse>;

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
export * from "./alerts.ts";
export * from "./auth.ts";
export * from "./machines.ts";
