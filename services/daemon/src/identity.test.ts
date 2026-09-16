import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MaschinaError } from "@maschina/core";
import { afterEach, describe, expect, it } from "vitest";
import { loadOrCreateIdentity } from "./identity.ts";

const dirs: string[] = [];
const tempPath = () => {
	const dir = mkdtempSync(join(tmpdir(), "maschina-identity-"));
	dirs.push(dir);
	return join(dir, "nested", "identity.json");
};

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("loadOrCreateIdentity", () => {
	it("creates an identity once and returns the same one afterwards", () => {
		const path = tempPath();
		const first = loadOrCreateIdentity(path, () => new Date("2026-09-16T00:00:00.000Z"));
		const second = loadOrCreateIdentity(path);
		expect(second).toEqual(first);
		expect(first.createdAt).toBe("2026-09-16T00:00:00.000Z");
		expect(first.publicKey).toContain("BEGIN PUBLIC KEY");
	});

	it("stores it readable by the owner only", () => {
		const path = tempPath();
		loadOrCreateIdentity(path);
		expect(statSync(path).mode & 0o777).toBe(0o600);
	});

	it("refuses to use an identity other users can read", () => {
		const path = tempPath();
		loadOrCreateIdentity(path);
		chmodSync(path, 0o644);
		expect(() => loadOrCreateIdentity(path)).toThrow(/chmod 600/);
	});

	it("refuses a corrupted or tampered file", () => {
		const path = tempPath();
		loadOrCreateIdentity(path);
		const stored = JSON.parse(readFileSync(path, "utf8"));
		writeFileSync(path, JSON.stringify({ ...stored, nodeId: "not-an-id" }), { mode: 0o600 });
		expect(() => loadOrCreateIdentity(path)).toThrow(MaschinaError);
		writeFileSync(path, JSON.stringify({ ...stored, privateKey: "stolen" }), { mode: 0o600 });
		expect(() => loadOrCreateIdentity(path)).toThrow(/not a valid daemon identity/);
	});
});
