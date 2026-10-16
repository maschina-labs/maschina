import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { checkReadme } from "./readme.mjs";

const roots = [];
after(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const HONEST = [
	"has not had an independent security audit",
	"no outside users",
	"Source-available",
	"Not open source",
].join(" ");

/** A throwaway repository: the workspaces it contains, and the README that describes them. */
function repo({ workspaces = {}, layout = "", extra = "", files = [] } = {}) {
	const root = mkdtempSync(join(tmpdir(), "maschina-readme-"));
	roots.push(root);
	for (const [workspace, names] of Object.entries(workspaces)) {
		for (const name of names) mkdirSync(join(root, workspace, name), { recursive: true });
	}
	for (const file of files) writeFileSync(join(root, file), "");
	writeFileSync(
		join(root, "README.md"),
		`# Maschina\n\n${HONEST}\n\n${extra}\n\n## Layout\n\n\`\`\`text\n${layout}\n\`\`\`\n`,
	);
	return root;
}

describe("the README check", () => {
	it("passes when the layout names every workspace that exists", () => {
		const root = repo({
			workspaces: { apps: ["web"], services: ["signer"], packages: ["core", "db"] },
			layout: "apps/  web\nservices/  signer\npackages/  core, db",
		});
		assert.deepEqual(checkReadme(root), []);
	});

	it("catches a package that exists and is not mentioned", () => {
		const root = repo({
			workspaces: { apps: ["web"], services: ["signer"], packages: ["core", "solana"] },
			layout: "apps/  web\nservices/  signer\npackages/  core",
		});
		const problems = checkReadme(root);
		assert.equal(problems.length, 1);
		assert.match(problems[0], /packages\/solana exists/);
	});

	it("does not accept a name that only appears inside a longer word", () => {
		// "app" must not be satisfied by "apps/", nor "auth" by "accounts".
		const root = repo({
			workspaces: { apps: ["app"], services: [], packages: ["auth"] },
			layout: "apps/\npackages/  accounts",
		});
		const problems = checkReadme(root);
		assert.equal(problems.length, 2);
	});

	it("catches a link to a file that does not exist", () => {
		const root = repo({
			workspaces: { apps: [], services: [], packages: [] },
			layout: "nothing",
			extra: "See [the license](LICENSE).",
		});
		assert.match(checkReadme(root)[0], /links to LICENSE, which does not exist/);
	});

	it("accepts a link to a file that does exist, and ignores external links and anchors", () => {
		const root = repo({
			workspaces: { apps: [], services: [], packages: [] },
			layout: "nothing",
			extra: "[license](LICENSE) [site](https://maschina.dev) [top](#maschina)",
			files: ["LICENSE"],
		});
		assert.deepEqual(checkReadme(root), []);
	});

	it("catches the honest lines quietly going missing", () => {
		const root = mkdtempSync(join(tmpdir(), "maschina-readme-"));
		roots.push(root);
		for (const w of ["apps", "services", "packages"]) mkdirSync(join(root, w), { recursive: true });
		// Everything an overclaiming README would look like: no audit line, no "not open source".
		writeFileSync(join(root, "README.md"), "# Maschina\n\n## Layout\n\n```text\nnothing\n```\n");
		const problems = checkReadme(root);
		assert.equal(problems.length, 4);
		assert.ok(problems.every((p) => p.includes("no longer says")));
	});

	it("says so when there is no layout block to check against", () => {
		const root = mkdtempSync(join(tmpdir(), "maschina-readme-"));
		roots.push(root);
		for (const w of ["apps", "services", "packages"]) mkdirSync(join(root, w), { recursive: true });
		writeFileSync(join(root, "README.md"), `# Maschina\n\n${HONEST}\n`);
		assert.match(checkReadme(root)[0], /no Layout block/);
	});
});
