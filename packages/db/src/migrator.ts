import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { connectionOptions } from "./connection.ts";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * Applies every pending migration. Runs as the owner role, which is the only role allowed to change
 * the schema.
 */
export async function runMigrations(url: string): Promise<void> {
	const sql = postgres(url, {
		...connectionOptions({ url, applicationName: "maschina-migrate", maxConnections: 1 }),
		onnotice: () => {},
	});
	try {
		await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
	} finally {
		await sql.end({ timeout: 5 });
	}
}
