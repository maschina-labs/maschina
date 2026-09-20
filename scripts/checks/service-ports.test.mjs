/**
 * Every service's image has to watch the port that service actually listens on.
 *
 * A Dockerfile copied from its neighbour keeps the neighbour's port, the container answers nothing on
 * it, and Docker calls the service unhealthy forever while it is working perfectly. That happened to
 * the provisioner, which probed the signer's 4200.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const services = new URL("../../services/", import.meta.url);

/** The port a service listens on by default, from its own config. */
function configuredPort(service) {
	const config = new URL(`${service}/src/config.ts`, services);
	const source = readFileSync(config, "utf8");
	return source.match(/env\.port\((\d+)\)/)?.[1];
}

for (const service of readdirSync(services)) {
	const dockerfile = readFileSync(new URL(`${service}/Dockerfile`, services), "utf8");
	const port = configuredPort(service);
	// The daemon dials out and listens for nothing, so it has no port to get wrong.
	if (!port) continue;

	test(`${service} exposes and checks the port it listens on`, () => {
		assert.equal(
			dockerfile.match(/EXPOSE (\d+)/)?.[1],
			port,
			"EXPOSE names another service's port",
		);
		assert.equal(
			dockerfile.match(/127\.0\.0\.1:(\d+)\/health/)?.[1],
			port,
			"the healthcheck asks another service's port",
		);
	});
}
