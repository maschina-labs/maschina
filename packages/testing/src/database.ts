/**
 * A fresh, migrated database for each test run, created from the template in
 * docker/postgres/init.sql and dropped afterwards. Tests never share state and never touch the
 * development database.
 */

import { randomBytes } from "node:crypto";
import { runMigrations } from "@maschina/db/migrate";
import postgres from "postgres";

export const TEST_OWNER_URL =
	process.env["DATABASE_MIGRATION_URL"] ??
	"postgres://maschina_owner:maschina_dev_password@localhost:5442/maschina";

export type TestDatabase = {
	name: string;
	ownerUrl: string;
	appUrl: string;
	drop: () => Promise<void>;
};

function withDatabase(url: string, database: string, credentials?: string): string {
	const parsed = new URL(url);
	parsed.pathname = `/${database}`;
	if (credentials) {
		const [user, password] = credentials.split(":");
		parsed.username = user ?? "";
		parsed.password = password ?? "";
	}
	return parsed.toString();
}

export async function createTestDatabase(ownerUrl = TEST_OWNER_URL): Promise<TestDatabase> {
	const name = `maschina_test_${randomBytes(6).toString("hex")}`;
	const admin = postgres(ownerUrl, { max: 1, onnotice: () => {} });
	try {
		await admin.unsafe(`CREATE DATABASE "${name}" TEMPLATE maschina_test_template`);
		await admin.unsafe(`GRANT CONNECT ON DATABASE "${name}" TO maschina_app`);
	} finally {
		await admin.end({ timeout: 5 });
	}

	const databaseOwnerUrl = withDatabase(ownerUrl, name);
	await runMigrations(databaseOwnerUrl);

	return {
		name,
		ownerUrl: databaseOwnerUrl,
		appUrl: withDatabase(ownerUrl, name, "maschina_app:maschina_dev_password"),
		drop: async () => {
			const cleanup = postgres(ownerUrl, { max: 1, onnotice: () => {} });
			try {
				await cleanup.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
			} finally {
				await cleanup.end({ timeout: 5 });
			}
		},
	};
}
