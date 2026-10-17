/**
 * `scripts/server/stale-images.sh` decides which of the server's images are safe to delete. Getting
 * it wrong in one direction fills the disk, which is what happened on 2026-10-17 (MISTAKES M47);
 * getting it wrong in the other deletes the image a running container needs. So it is tested here
 * against the real script, by feeding it the kind of listing `docker image ls` actually prints.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../server/stale-images.sh", import.meta.url));

/** What the script says to remove, given a listing and the versions to keep. */
function remove(listing, ...keep) {
	const out = execFileSync("bash", [script, ...keep], {
		input: listing.join("\n"),
		encoding: "utf8",
	});
	return out.split("\n").filter(Boolean);
}

const image = (service, version) => `ghcr.io/maschina-labs/${service}:${version}`;

describe("which images the server may delete", () => {
	it("keeps the version running and the one before it, and removes the rest", () => {
		const listing = ["0.0.49", "0.0.50", "0.0.51", "0.0.52", "0.0.53"].map((v) =>
			image("gateway", v),
		);

		assert.deepEqual(remove(listing, "0.0.53", "0.0.52"), [
			image("gateway", "0.0.49"),
			image("gateway", "0.0.50"),
			image("gateway", "0.0.51"),
		]);
	});

	it("does the same for every service, not only the one it happens to see first", () => {
		const listing = ["gateway", "signer", "daemon"].flatMap((s) => [
			image(s, "0.0.52"),
			image(s, "0.0.53"),
		]);

		assert.deepEqual(remove(listing, "0.0.53"), [
			image("gateway", "0.0.52"),
			image("signer", "0.0.52"),
			image("daemon", "0.0.52"),
		]);
	});

	it("never touches an image that is not ours: Postgres and the tunnel stay", () => {
		const listing = [
			"postgres:17-alpine",
			"cloudflare/cloudflared:2026.9.1",
			image("gateway", "0.0.49"),
		];

		assert.deepEqual(remove(listing, "0.0.53"), [image("gateway", "0.0.49")]);
	});

	it("keeps everything when told to keep everything it was shown", () => {
		const listing = [image("gateway", "0.0.52"), image("gateway", "0.0.53")];

		assert.deepEqual(remove(listing, "0.0.53", "0.0.52"), []);
	});

	it("removes nothing at all when it is told no version to keep, rather than removing everything", () => {
		const listing = [image("gateway", "0.0.52"), image("gateway", "0.0.53")];

		assert.deepEqual(remove(listing), []);
	});

	it("leaves an untagged or oddly named line alone rather than guessing", () => {
		const listing = [
			"ghcr.io/maschina-labs/gateway:<none>",
			"ghcr.io/maschina-labs/gateway",
			image("gateway", "0.0.49"),
		];

		assert.deepEqual(remove(listing, "0.0.53"), [image("gateway", "0.0.49")]);
	});
});
