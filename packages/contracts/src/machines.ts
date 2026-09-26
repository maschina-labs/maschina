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
		/** A machine that only pretends to trade, so an owner can read what it would have done. */
		paper: z.boolean().optional(),
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

/** A machine as an owner sees it in a list. */
export const MachineSummary = z
	.strictObject({
		machineId: z.string(),
		name: z.string(),
		kind: z.string(),
		walletAddress: address,
		createdAt: z.iso.datetime(),
		state: z.enum(["draft", "ready", "running", "paused", "stopped"]),
		stateReason: z.string().optional(),
		budget: z.strictObject({
			granted: whole,
			reserved: whole,
			settled: whole,
			available: whole,
		}),
	})
	.meta({ id: "MachineSummary" });
export type MachineSummary = z.infer<typeof MachineSummary>;

export const MachineList = z
	.strictObject({ machines: z.array(MachineSummary) })
	.meta({ id: "MachineList" });
export type MachineList = z.infer<typeof MachineList>;

/** One machine, with what it is set to do and what its owner may do next. */
export const MachineDetail = MachineSummary.extend({
	settings: z.unknown(),
	limits: z.strictObject({
		maxPerTrade: whole.optional(),
		maxPerDay: whole.optional(),
		approvedMints: z.array(address),
	}),
	actions: z.array(z.enum(["fund", "start", "pause", "resume", "stop"])),
}).meta({ id: "MachineDetail" });
export type MachineDetail = z.infer<typeof MachineDetail>;

/** What an owner asks a machine to do. Funding carries the budget it may now spend in total. */
export const MachineActionRequest = z
	.strictObject({
		action: z.enum(["fund", "start", "pause", "resume", "stop"]),
		budgetGranted: whole.optional(),
	})
	.meta({ id: "MachineActionRequest" });
export type MachineActionRequest = z.infer<typeof MachineActionRequest>;

export const MachineActionResponse = z
	.strictObject({ state: z.enum(["draft", "ready", "running", "paused", "stopped"]) })
	.meta({ id: "MachineActionResponse" });
export type MachineActionResponse = z.infer<typeof MachineActionResponse>;

/** A machine's record: what it did, and why, newest first. */
export const MachineEvent = z
	.strictObject({
		id: z.string(),
		type: z.string(),
		occurredAt: z.iso.datetime(),
		payload: z.unknown(),
	})
	.meta({ id: "MachineEvent" });
export type MachineEvent = z.infer<typeof MachineEvent>;

export const MachineRecord = z
	.strictObject({ events: z.array(MachineEvent) })
	.meta({ id: "MachineRecord" });
export type MachineRecord = z.infer<typeof MachineRecord>;
