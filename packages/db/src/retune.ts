/**
 * Changing the recipe a machine runs.
 *
 * The machine keeps its wallet, its vault, its money and its record. What changes is the definition it
 * points at, and the change is written to the record in the same transaction, so what the machine was
 * running at any moment can always be read back.
 *
 * Only a paused machine can be retuned. A running one may be halfway through a run that read the old
 * recipe, and letting that run finish under one recipe and report under another is how a record stops
 * adding up. The owner pauses it, retunes it, and resumes it.
 *
 * The token it spends cannot change. Its budget is counted in that token, and a budget in dollars read
 * as a budget in anything else is not a limit.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import {
	budgetMintOf,
	checkMachineSettings,
	KNOWN_KINDS,
	machineLimits,
	machineState,
} from "@maschina/runtime";
import { sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import { definitionId } from "./definitions.ts";
import { readMachineEvents } from "./read-events.ts";
import { appendOwnerEvent } from "./record.ts";

export type RetuneRequest = {
	ownerId: string;
	machineId: string;
	kind: string;
	settings: Record<string, unknown>;
};

type Current = { definition_id: string; kind: string; settings: unknown; rules: unknown };

export async function retuneMachine(
	db: Database,
	request: RetuneRequest,
): Promise<Result<{ definitionId: string }, MaschinaError>> {
	return db.transaction(async (tx) => {
		// Looked up as this owner's, so somebody else's machine simply does not exist here.
		const rows = await tx.execute<Current>(sql`
			select machines.definition_id, machine_definitions.kind, machine_definitions.settings,
				machine_definitions.rules
			from machines
			join machine_definitions on machine_definitions.id = machines.definition_id
			where machines.id = ${request.machineId}::uuid and machines.owner_id = ${request.ownerId}::uuid
			for update of machines`);
		const current = rows[0];
		if (!current) return err(new MaschinaError("not_found", "no such machine"));

		const events = await readMachineEvents(tx, request.machineId);
		const state = machineState(events).state;
		if (state !== "paused") {
			return err(
				new MaschinaError("conflict", "pause the machine before changing its recipe", {
					details: { state },
				}),
			);
		}

		const checked = checkMachineSettings(KNOWN_KINDS, {
			kind: request.kind,
			settings: request.settings,
			approvedMints: machineLimits(events).approvedMints,
		});
		if (!checked.ok) return err(new MaschinaError("invalid_input", checked.problem));

		const spends = budgetMintOf(KNOWN_KINDS, current.kind, current.settings);
		const willSpend = budgetMintOf(KNOWN_KINDS, request.kind, request.settings);
		if (spends !== willSpend) {
			return err(
				new MaschinaError(
					"invalid_input",
					"a machine keeps spending the token its budget is counted in",
					{ details: { spends, willSpend } },
				),
			);
		}

		// The rules stay as they were. Only the recipe's kind and settings are the owner's to change here.
		const rules = (current.rules ?? {}) as Record<string, unknown>;
		const to = definitionId({ kind: request.kind, settings: request.settings, rules });
		if (to === current.definition_id) {
			return err(new MaschinaError("invalid_input", "that is the recipe it already runs"));
		}

		await tx.execute(sql`
			insert into machine_definitions (id, kind, settings, rules)
			values (${to}, ${request.kind}, ${JSON.stringify(request.settings)}::jsonb,
				${JSON.stringify(rules)}::jsonb)
			on conflict (id) do nothing`);
		await tx.execute(sql`
			update machines set definition_id = ${to} where id = ${request.machineId}::uuid`);

		const written = await appendOwnerEvent(tx, {
			machineId: request.machineId,
			type: "machine.retuned",
			payload: { from: current.definition_id, to },
		});
		if (!written.ok) return written;
		return ok({ definitionId: to });
	});
}
