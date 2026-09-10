#!/usr/bin/env node
/**
 * Make node-pty's spawn helper executable.
 *
 * On macOS and Linux node-pty spawns through a small helper binary. It ships in
 * a prebuild archive, and the executable bit does not survive extraction, so
 * every spawn fails with `posix_spawnp failed` and no indication why.
 *
 * A reinstall puts the file back without the bit, so this runs before the dev
 * server rather than once by hand.
 *
 * Idempotent, silent when there is nothing to do, and it never fails the run:
 * the terminal not working is a reason to say so, not to stop somebody working
 * on everything else.
 */

import { chmodSync, existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

if (process.platform === "win32") process.exit(0);

try {
	const require = createRequire(import.meta.url);
	const pty = dirname(require.resolve("node-pty"));
	const prebuilds = join(pty, "..", "prebuilds");
	if (!existsSync(prebuilds)) process.exit(0);

	let fixed = 0;
	for (const platform of readdirSync(prebuilds)) {
		const helper = join(prebuilds, platform, "spawn-helper");
		if (!existsSync(helper)) continue;
		// 0o111 is the three execute bits. Already set means nothing to do.
		if ((statSync(helper).mode & 0o111) !== 0) continue;
		chmodSync(helper, 0o755);
		fixed++;
	}
	if (fixed > 0) console.log(`Made ${fixed} terminal helper(s) executable.`);
} catch {
	// node-pty not installed, a read-only store, a different layout. The terminal
	// will say it cannot start, which is more useful than failing here.
}
