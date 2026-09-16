import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { type ConnectionConfig, connectionOptions } from "./connection.ts";
import * as schema from "./schema/index.ts";

export type Database = PostgresJsDatabase<typeof schema>;

export type DatabaseHandle = {
	db: Database;
	sql: postgres.Sql;
	ping: () => Promise<boolean>;
	close: () => Promise<void>;
};

export function createDatabase(config: ConnectionConfig): DatabaseHandle {
	const sql = postgres(config.url, connectionOptions(config));
	return {
		db: drizzle(sql, { schema, casing: "snake_case" }),
		sql,
		ping: async () => {
			try {
				await sql`select 1`;
				return true;
			} catch {
				return false;
			}
		},
		close: () => sql.end({ timeout: 5 }),
	};
}
