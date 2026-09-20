/**
 * What the production compose file must never do.
 *
 * The server's safety comes from nothing being reachable from outside it. That is easy to break with one
 * convenient port mapping, so it is checked here rather than remembered.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const file = readFileSync(new URL("../../docker/compose.prod.yml", import.meta.url), "utf8");

test("publishes no ports to the outside world", () => {
	assert.equal(
		/^\s*ports:/m.test(file),
		false,
		"a service publishes a port; nothing may be reachable",
	);
});

test("runs released images rather than building on the server", () => {
	for (const service of ["orchestrator", "signer", "provisioner", "daemon"]) {
		assert.match(
			file,
			new RegExp(`image: ghcr\\.io/maschina-labs/${service}:\\$\\{MASCHINA_VERSION`),
		);
	}
	assert.equal(/^\s*build:/m.test(file), false, "the server does not build images");
});

test("refuses to start without the version and the database password", () => {
	assert.match(file, /MASCHINA_VERSION:\?/);
	assert.match(file, /POSTGRES_PASSWORD:\?/);
});

test("restarts everything after a reboot", () => {
	const restarts = file.match(/restart: unless-stopped/g) ?? [];
	assert.equal(restarts.length, 5, "every service restarts itself");
});

test("keeps the node's identity across restarts", () => {
	assert.match(file, /daemon-identity:\/home\/node\/\.maschina/);
});
