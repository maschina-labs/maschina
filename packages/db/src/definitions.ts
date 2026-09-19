/**
 * Saving machine definitions.
 *
 * The id comes from the content, so saving the same recipe twice is not an error and not a second row:
 * it returns the same id. That is what lets a copied machine (D-028) point at exactly the recipe it was
 * copied from, and what makes "the definition changed" impossible to say without a new id.
 */

import { err, MaschinaError, ok, type Result } from "@maschina/core";
import { contentId } from "@maschina/core/content";
import { sql } from "drizzle-orm";
import type { Database } from "./client.ts";

export type MachineDefinition = {
	kind: string;
	settings: Record<string, unknown>;
	rules: Record<string, unknown>;
};

export type SavedDefinition = { id: string; created: boolean };

const KIND = /^[a-z][a-z0-9_]{2,39}$/;

/** The id a definition will have, without saving it. */
export function definitionId(definition: MachineDefinition): string {
	return contentId({
		kind: definition.kind,
		settings: definition.settings,
		rules: definition.rules,
	});
}

export async function saveDefinition(
	db: Database,
	definition: MachineDefinition,
): Promise<Result<SavedDefinition, MaschinaError>> {
	if (!KIND.test(definition.kind)) {
		return err(
			new MaschinaError("invalid_input", "a machine kind is lower case letters, digits and _", {
				details: { kind: definition.kind },
			}),
		);
	}
	let id: string;
	try {
		id = definitionId(definition);
	} catch (error) {
		return err(
			error instanceof MaschinaError
				? error
				: new MaschinaError("invalid_input", "the definition can't be stored", { cause: error }),
		);
	}

	const rows = await db.execute<{ id: string }>(sql`
		insert into machine_definitions (id, kind, settings, rules)
		values (${id}, ${definition.kind}, ${JSON.stringify(definition.settings)}::jsonb,
			${JSON.stringify(definition.rules)}::jsonb)
		on conflict (id) do nothing
		returning id`);
	return ok({ id, created: rows.length > 0 });
}
