/**
 * Creating a machine.
 *
 * Everything an owner decides at the moment a machine is made: what it is, what it may spend, and what
 * it may touch. Limits are not optional extras here. A machine is created with them or not at all.
 */

import { z } from "zod";

const address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "not an address");
const whole = z.string().regex(/^\d+$/, "not a whole number");

export const CreateMachineRequest = z
	.strictObject({
		/** The owner's own wallet. The machine's funds can never reach anywhere else. */
		ownerWallet: address,
		name: z.string().min(1).max(60),
		kind: z.string().min(1).max(40),
		settings: z.record(z.string(), z.unknown()),
		rules: z.record(z.string(), z.unknown()).optional(),
		limits: z.strictObject({
			budgetGranted: whole,
			maxPerTrade: whole.optional(),
			maxPerDay: whole.optional(),
			approvedMints: z.array(address).min(1).max(20),
		}),
	})
	.meta({ id: "CreateMachineRequest" });
export type CreateMachineRequest = z.infer<typeof CreateMachineRequest>;

export const CreateMachineResponse = z
	.strictObject({
		machineId: z.string(),
		ownerId: z.string(),
		/** The machine's own wallet, which the owner funds. */
		walletAddress: address,
		definitionId: z.string(),
	})
	.meta({ id: "CreateMachineResponse" });
export type CreateMachineResponse = z.infer<typeof CreateMachineResponse>;
