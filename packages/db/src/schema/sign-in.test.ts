import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { sessions, signInNonces } from "./sign-in.ts";

describe("the sign in nonces table", () => {
	const table = getTableConfig(signInNonces);

	it("keeps its name and columns", () => {
		expect(table.name).toBe("sign_in_nonces");
		expect(table.columns.map((column) => column.name).sort()).toEqual([
			"expires_at",
			"issued_at",
			"nonce",
			"used_at",
			"wallet_address",
		]);
	});

	it("makes the nonce itself the key, so the same one cannot exist twice", () => {
		expect(table.columns.filter((column) => column.primary).map((column) => column.name)).toEqual([
			"nonce",
		]);
	});

	it("leaves used_at empty until the nonce is answered", () => {
		const used = table.columns.find((column) => column.name === "used_at");
		expect(used?.notNull).toBe(false);
	});

	it("checks the shape of the wallet address in the database itself", () => {
		expect(table.checks.map((check) => check.name)).toEqual(["sign_in_nonces_wallet_shape"]);
	});
});

describe("the sessions table", () => {
	const table = getTableConfig(sessions);

	it("keeps its name and columns", () => {
		expect(table.name).toBe("sessions");
		expect(table.columns.map((column) => column.name).sort()).toEqual([
			"created_at",
			"ended_at",
			"expires_at",
			"id",
			"owner_id",
			"token_hash",
		]);
	});

	it("stores the hash of a token and never the token", () => {
		expect(table.columns.map((column) => column.name)).not.toContain("token");
		expect(table.columns.find((column) => column.name === "token_hash")?.isUnique).toBe(true);
	});

	it("belongs to an owner, and says when it stops being valid", () => {
		const required = table.columns
			.filter((column) => column.notNull && !column.hasDefault)
			.map((column) => column.name)
			.sort();
		expect(required).toEqual(["expires_at", "id", "owner_id", "token_hash"]);
	});

	it("checks the id is a v7 id, like every id in the record", () => {
		expect(table.checks.map((check) => check.name)).toEqual(["sessions_id_is_v7"]);
	});
});
