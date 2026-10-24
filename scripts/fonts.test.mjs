import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { fontsWanted, whatToFetch } from "./fonts.mjs";

const roots = [];
after(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A throwaway apps folder: each app, and the stylesheet and page that ask for fonts. */
function apps(byApp) {
	const root = mkdtempSync(join(tmpdir(), "maschina-fonts-"));
	roots.push(root);
	for (const [app, files] of Object.entries(byApp)) {
		mkdirSync(join(root, app, "src"), { recursive: true });
		for (const [name, text] of Object.entries(files)) writeFileSync(join(root, app, name), text);
	}
	return root;
}

const face = (name) => `@font-face { src: url("/fonts/${name}") format("woff2"); }`;

describe("which fonts a page asks for", () => {
	it("reads them out of the stylesheet, once each, in order", () => {
		const css = [face("Sohne-400.woff2"), face("Sohne-500.woff2"), face("Sohne-400.woff2")].join(
			"\n",
		);

		assert.deepEqual(fontsWanted(css), ["Sohne-400.woff2", "Sohne-500.woff2"]);
	});

	it("finds the ones a page preloads as well as the ones the stylesheet names", () => {
		const html = '<link rel="preload" href="/fonts/SohneBreit-600.otf" as="font" />';

		assert.deepEqual(fontsWanted(`${face("Sohne-400.woff2")}\n${html}`), [
			"Sohne-400.woff2",
			"SohneBreit-600.otf",
		]);
	});

	it("takes only plain file names, so nothing can reach past the bucket's own objects", () => {
		const nasty = [
			'url("/fonts/../../etc/passwd")',
			'url("/fonts/nested/Sohne-400.woff2")',
			'url("/fonts/Sohne-400.woff2?v=2")',
			'url("https://example.com/fonts/Sohne-400.woff2")',
		].join("\n");

		assert.deepEqual(fontsWanted(nasty), []);
	});

	it("ignores a font served from somewhere else, such as Google", () => {
		const google =
			'<link href="https://fonts.googleapis.com/css2?family=Geist" rel="stylesheet" />';

		assert.deepEqual(fontsWanted(google), []);
	});
});

describe("what to fetch, and where to put it", () => {
	it("gives every app that asks for a font its own list", () => {
		const root = apps({
			web: { "src/styles.css": face("Sohne-400.woff2") },
			app: { "src/styles.css": [face("Sohne-400.woff2"), face("Sohne-700.woff2")].join("\n") },
		});

		assert.deepEqual(whatToFetch(root), [
			{
				app: "app",
				into: join(root, "app", "public", "fonts"),
				fonts: ["Sohne-400.woff2", "Sohne-700.woff2"],
			},
			{ app: "web", into: join(root, "web", "public", "fonts"), fonts: ["Sohne-400.woff2"] },
		]);
	});

	it("leaves out an app that asks for no font of its own", () => {
		const root = apps({
			web: { "src/styles.css": face("Sohne-400.woff2") },
			docs: { "src/styles.css": "body { color: white; }" },
		});

		assert.deepEqual(
			whatToFetch(root).map((one) => one.app),
			["web"],
		);
	});

	it("reads the page as well as the stylesheet, since a preload names a file the stylesheet may not", () => {
		const root = apps({
			web: {
				"src/styles.css": face("Sohne-400.woff2"),
				"index.html": '<link rel="preload" href="/fonts/Sohne-500.woff2" as="font" />',
			},
		});

		assert.deepEqual(whatToFetch(root)[0]?.fonts, ["Sohne-400.woff2", "Sohne-500.woff2"]);
	});
});

describe("an app whose Worker serves no fonts", () => {
	it("is skipped, since a redirect has no page to ask for a font", () => {
		const root = apps({
			web: {
				"src/styles.css": face("Sohne-400.woff2"),
				"wrangler.jsonc": '{ "r2_buckets": [{ "binding": "FONTS" }] }',
			},
			old: {
				"src/styles.css": face("Sohne-400.woff2"),
				"wrangler.jsonc": '{ "main": "./src/worker.ts" }',
			},
		});

		assert.deepEqual(
			whatToFetch(root).map((one) => one.app),
			["web"],
		);
	});
});

describe("this repository, as it stands", () => {
	const apps = fileURLToPath(new URL("../apps/", import.meta.url));

	it("fetches fonts for every app that asks for one, and for no app that does not", () => {
		const asking = readdirSync(apps, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.filter((app) => readFileSync(join(apps, app, "wrangler.jsonc"), "utf8").includes('"FONTS"'))
			.filter((app) =>
				["src/styles.css", "index.html"]
					.map((file) => join(apps, app, file))
					.some((path) => existsSync(path) && fontsWanted(readFileSync(path, "utf8")).length > 0),
			);

		assert.deepEqual(
			whatToFetch(apps).map((one) => one.app),
			asking.sort(),
		);
	});

	it("fetches exactly the files each app's own Worker would serve from the bucket", () => {
		for (const { app, fonts } of whatToFetch(apps)) {
			const worker = join(apps, app, "src", "worker.ts");
			// An app with no Worker in front of it serves no font in production, which is its own problem.
			assert.ok(existsSync(worker), `${app} asks for fonts but has no Worker to serve them`);
			const pattern = /const FONT = \/\^(.*)\$\/;/.exec(readFileSync(worker, "utf8"))?.[1];
			assert.ok(pattern, `${app}'s Worker does not say which names it serves`);
			for (const font of fonts) {
				assert.match(font, new RegExp(`^${pattern}$`), `${app} asks for ${font}`);
			}
		}
	});
});
