import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { storeInInfisical } from "./infisical.ts";

describe("storeInInfisical", () => {
	it("hands the secrets over in a private file, never on the command line, and deletes it", async () => {
		let seen: { args: string[]; content: string; mode: number; file: string } | undefined;
		await storeInInfisical(
			{ SIGNER_PRIVATE: "abc123", SIGNER_PUBLIC: "02ff" },
			{
				env: "dev",
				path: "/wallet-spike",
				run: async (args) => {
					const file = args[args.indexOf("--file") + 1] ?? "";
					seen = {
						args,
						content: readFileSync(file, "utf8"),
						mode: statSync(file).mode & 0o777,
						file,
					};
				},
			},
		);
		assert.ok(seen);
		assert.deepEqual(seen.args, [
			"secrets",
			"set",
			"--file",
			seen.file,
			"--env",
			"dev",
			"--path",
			"/wallet-spike",
			"--silent",
		]);
		assert.ok(!seen.args.some((arg) => arg.includes("abc123")));
		assert.equal(seen.content, "SIGNER_PRIVATE=abc123\nSIGNER_PUBLIC=02ff\n");
		assert.equal(seen.mode, 0o600);
		assert.equal(existsSync(seen.file), false);
	});

	it("deletes the file even when saving fails", async () => {
		let file = "";
		await assert.rejects(
			storeInInfisical(
				{ A: "b" },
				{
					env: "dev",
					path: "/x",
					run: async (args) => {
						file = args[args.indexOf("--file") + 1] ?? "";
						throw new Error("not logged in");
					},
				},
			),
			/not logged in/,
		);
		assert.ok(file);
		assert.equal(existsSync(file), false);
	});

	it("refuses names and values that could break the file", async () => {
		const run = async () => {};
		for (const secrets of [{ "BAD NAME": "x" }, { GOOD: "line\nbreak" }, { GOOD: "" }]) {
			await assert.rejects(storeInInfisical(secrets, { env: "dev", path: "/x", run }), /invalid/);
		}
	});
});
