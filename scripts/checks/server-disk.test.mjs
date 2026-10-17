/**
 * The server has one disk and every release pulls a fresh image for each service. Nothing removed the
 * old ones, so after 49 releases the box held 221 images and 32GB of them were no longer in use. It
 * hit 100% and a deploy died in the middle of extracting a layer (MISTAKES M47).
 *
 * These read the deploy rather than trusting it.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const update = read("../server/update.sh");
const prune = read("../server/prune.sh");
const deploy = read("../../.github/workflows/deploy.yml");

test("a release carries the scripts it needs to clean up after itself", () => {
	for (const script of ["prune.sh", "stale-images.sh"]) {
		assert.match(
			deploy,
			new RegExp(`scripts/server/${script.replace(".", "\\.")}`),
			`the deploy never copies ${script} to the server, so it cannot run there`,
		);
	}
});

test("the deploy refuses to pull when the disk is too small to hold the pull", () => {
	const checked = update.search(/df -Pk/);
	const pulled = update.indexOf("pull --quiet");
	assert.ok(checked > 0, "update.sh never looks at how much disk is free");
	assert.ok(
		checked < pulled,
		"the disk has to be checked before the pull, or it dies half way as it did on 2026-10-17",
	);
	assert.match(
		update.slice(checked, pulled),
		/exit 1/,
		"too little disk has to stop the deploy, not warn and carry on",
	);
});

test("a finished deploy removes the images older releases left behind", () => {
	const started = update.indexOf("up -d --remove-orphans");
	const cleaned = update.indexOf("stale-images.sh");
	assert.ok(cleaned > 0, "update.sh never removes an old image");
	assert.ok(cleaned > started, "cleaning up belongs after the new version is up, never before");
});

test("cleaning up keeps the version that is running and the one before it", () => {
	assert.match(
		update,
		/stale-images\.sh "\$VERSION" "\$previous"/,
		"a rollback needs the previous version's images still on the box",
	);
});

test("nothing in the cleanup touches a volume, because the database lives in one", () => {
	for (const [name, text] of [
		["update.sh", update],
		["prune.sh", prune],
	]) {
		assert.doesNotMatch(text, /--volumes|volume\s+(rm|prune)/, `${name} must never touch a volume`);
		assert.doesNotMatch(
			text,
			/system prune/,
			`${name} must not use system prune, which reaches further than images`,
		);
	}
});

test("cleaning up stops and restarts nothing, so a running machine never notices (D-088)", () => {
	const after = update.slice(update.indexOf("stale-images.sh"));
	assert.doesNotMatch(after, /\b(stop|restart|down|kill)\b/, "the cleanup must not move a service");
	assert.doesNotMatch(prune, /\b(stop|restart|down|kill)\b/, "prune.sh must not move a service");
});
