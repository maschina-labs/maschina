#!/usr/bin/env node
/**
 * Make the menu bar say Maschina while running from source.
 *
 * On macOS the first menu title comes from the bundle's `CFBundleName`, not from
 * the running application, and Electron documents that the first menu item's
 * label is always the bundle name whatever you set. `app.setName()` therefore
 * fixes the dock tooltip and the About panel and cannot fix the menu bar.
 *
 * Running from source means running Electron's own `Electron.app`, which calls
 * itself Electron. This renames that copy.
 *
 * **It edits node_modules, which is normally wrong.** It is done here because
 * the alternative is a menu bar that lies for the whole of development, and
 * because the change is confined to one string in one file that npm rewrites on
 * every install anyway. A packaged build never touches this: it gets its name
 * from `productName`.
 *
 * Idempotent, and silent when there is nothing to do. Never fails the run: a
 * wrong name in a menu is not a reason to stop somebody working.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const NAME = "Maschina";

if (process.platform !== "darwin") process.exit(0);

try {
	const require = createRequire(import.meta.url);
	const electron = dirname(require.resolve("electron"));
	const plist = join(electron, "dist", "Electron.app", "Contents", "Info.plist");
	if (!existsSync(plist)) process.exit(0);

	const read = (key) =>
		execFileSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plist], {
			encoding: "utf8",
		}).trim();

	if (read("CFBundleName") === NAME) process.exit(0);

	for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
		execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${NAME}`, plist]);
	}
	console.log(`Named the development bundle ${NAME}.`);
} catch {
	// Electron not installed yet, a read-only store, a different layout. None of
	// those are worth stopping for.
}
