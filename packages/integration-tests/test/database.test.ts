import { createDatabase } from "@maschina/db";
import { createTestDatabase, type TestDatabase } from "@maschina/testing";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
});

afterAll(async () => {
	await database?.drop();
});

describe("the database", () => {
	it("is reachable as the app role", async () => {
		const handle = createDatabase({ url: database.appUrl, applicationName: "integration-test" });
		try {
			expect(await handle.ping()).toBe(true);
			const [row] = await handle.sql<{ user: string }[]>`select current_user as user`;
			expect(row?.user).toBe("maschina_app");
		} finally {
			await handle.close();
		}
	});

	it("has the migrations applied", async () => {
		const sql = postgres(database.ownerUrl, { max: 1, onnotice: () => {} });
		try {
			const [row] = await sql<{ exists: boolean }[]>`
				select exists (
					select 1 from information_schema.tables
					where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
				) as exists`;
			expect(row?.exists).toBe(true);
		} finally {
			await sql.end();
		}
	});

	it("refuses schema changes from the app role", async () => {
		const sql = postgres(database.appUrl, { max: 1, onnotice: () => {} });
		try {
			await expect(sql`create table not_allowed (id int)`).rejects.toThrow(/permission denied/);
		} finally {
			await sql.end();
		}
	});

	it("reports a dead connection instead of throwing", async () => {
		const handle = createDatabase({
			url: "postgres://maschina_app:wrong@localhost:5442/does_not_exist",
			applicationName: "integration-test",
		});
		try {
			expect(await handle.ping()).toBe(false);
		} finally {
			await handle.close();
		}
	});
});

describe("test databases", () => {
	it("are isolated from each other", async () => {
		const other = await createTestDatabase();
		try {
			expect(other.name).not.toBe(database.name);
			const a = postgres(database.ownerUrl, { max: 1, onnotice: () => {} });
			const b = postgres(other.ownerUrl, { max: 1, onnotice: () => {} });
			try {
				await a`create table only_here (id int)`;
				const [row] = await b<{ exists: boolean }[]>`
					select exists (select 1 from information_schema.tables where table_name = 'only_here') as exists`;
				expect(row?.exists).toBe(false);
			} finally {
				await a.end();
				await b.end();
			}
		} finally {
			await other.drop();
		}
	});
});
