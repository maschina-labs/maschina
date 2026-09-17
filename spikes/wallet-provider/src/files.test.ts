import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { readJsonIfPresent } from "./files.ts";

describe("readJsonIfPresent", () => {
	const dir = mkdtempSync(join(tmpdir(), "wallet-spike-files-"));
	after(() => rmSync(dir, { recursive: true, force: true }));

	it("reads a JSON file in one step", () => {
		const path = join(dir, "present.json");
		writeFileSync(path, '{"address":"abc"}');
		assert.deepEqual(readJsonIfPresent(path), { address: "abc" });
	});

	it("returns nothing when the file doesn't exist", () => {
		assert.equal(readJsonIfPresent(join(dir, "missing.json")), undefined);
	});

	it("still fails on a file that exists but can't be used", () => {
		const path = join(dir, "broken.json");
		writeFileSync(path, "{not json");
		assert.throws(() => readJsonIfPresent(path), SyntaxError);
		assert.throws(() => readJsonIfPresent(dir), /EISDIR/);
	});
});
