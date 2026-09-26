/**
 * A release has to carry its own schema, and apply it before its code runs.
 *
 * The deploy used to copy `compose.migrate.yml` to the server and never call it, so every release put
 * new code in front of an old schema and somebody had to notice. On 2026-09-26 nobody did: production
 * ran for hours on code that selected a column the database did not have.
 *
 * These read the deploy rather than trusting it.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const update = read("../server/update.sh");
const compose = read("../../docker/compose.prod.yml");
const images = read("../../.github/workflows/images.yml");

test("the deploy applies migrations", () => {
	assert.match(update, /run --rm migrator/, "update.sh never runs the migrator");
});

test("migrations run before the new code starts", () => {
	const migrated = update.indexOf("run --rm migrator");
	const started = update.indexOf("up -d --remove-orphans");
	assert.ok(migrated > 0 && started > 0, "both steps have to be in update.sh");
	assert.ok(
		migrated < started,
		"the schema has to move before the code does, or new code meets an old schema",
	);
});

test("a failed migration leaves the running version alone", () => {
	const after = update.slice(update.indexOf("run --rm migrator"));
	const failure = after.slice(0, after.indexOf("up -d --remove-orphans"));
	assert.match(failure, /exit 1/, "a failed migration has to stop the deploy");
});

test("the migrator is part of the release, pinned to its version", () => {
	assert.match(compose, /^ {2}migrator:/m, "compose.prod.yml has no migrator");
	assert.match(
		compose,
		/image: ghcr\.io\/maschina-labs\/migrator:\$\{MASCHINA_VERSION/,
		"the migrator has to be the same version as everything else",
	);
});

test("the migrator never starts with the rest of the stack", () => {
	const service = compose.slice(compose.indexOf("  migrator:"));
	const body = service.slice(0, service.indexOf("\n  orchestrator:"));
	assert.match(body, /profiles: \["migrate"\]/, "the migrator has to be behind a profile");
});

test("the migrator image is built with the others", () => {
	assert.match(images, /service: \[.*migrator.*\]/, "the images matrix has no migrator");
	assert.match(
		images,
		/dockerfile: packages\/db\/Dockerfile/,
		"the migrator has no Dockerfile path",
	);
});
