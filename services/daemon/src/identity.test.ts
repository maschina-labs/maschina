import { spawn } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
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

	it("refuses an identity reached through a symbolic link", () => {
		// A link can be swapped to point somewhere else between checking the file and reading it.
		const real = tempPath();
		loadOrCreateIdentity(real);
		const link = join(real, "..", "link.json");
		symlinkSync(real, link);
		expect(() => loadOrCreateIdentity(link)).toThrow(/symbolic link/);
	});

	it("refuses anything that isn't a regular file", () => {
		const path = tempPath();
		mkdirSync(path, { recursive: true });
		expect(() => loadOrCreateIdentity(path)).toThrow(/not a regular file/);
	});

	// Root can open a file whatever its permissions, so this can only be tested as a normal user.
	it.skipIf(process.getuid?.() === 0)(
		"reports a file it isn't allowed to open instead of replacing it",
		() => {
			const path = tempPath();
			loadOrCreateIdentity(path);
			chmodSync(path, 0o000);
			expect(() => loadOrCreateIdentity(path)).toThrow(/EACCES|permission denied/i);
			chmodSync(path, 0o600);
		},
	);

	it("refuses a file that isn't JSON", () => {
		const path = tempPath();
		mkdirSync(join(path, ".."), { recursive: true });
		writeFileSync(path, "not json", { mode: 0o600 });
		expect(() => loadOrCreateIdentity(path)).toThrow(/not a valid daemon identity/);
	});

	// Eight real Node processes start here. That takes a fraction of a second on a laptop and over five
	// seconds in a busy CI container, so this test gets its own limit instead of the default.
	it("gives daemons starting at the same moment the same identity", async () => {
		const path = tempPath();
		const script = `import { loadOrCreateIdentity } from ${JSON.stringify(new URL("./identity.ts", import.meta.url).pathname)};
process.stdout.write(loadOrCreateIdentity(process.argv[1]).nodeId);`;
		const start = () =>
			new Promise<string>((resolve, reject) => {
				const child = spawn(process.execPath, ["--input-type=module", "-e", script, path]);
				let out = "";
				let err = "";
				child.stdout.on("data", (chunk) => {
					out += chunk;
				});
				child.stderr.on("data", (chunk) => {
					err += chunk;
				});
				child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err))));
			});
		const ids = await Promise.all(Array.from({ length: 8 }, start));
		expect(new Set(ids).size).toBe(1);
	}, 60_000);

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
