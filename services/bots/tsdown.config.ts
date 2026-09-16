import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/main.ts"],
	format: "esm",
	platform: "node",
	target: "node24",
	sourcemap: true,
	clean: true,
	// Workspace packages ship as TypeScript source, so they are compiled in. Everything from npm stays
	// external and is installed next to the bundle, because some of it (pino transports, Sentry) loads
	// files at runtime and breaks when bundled.
	deps: {
		neverBundle: true,
		alwaysBundle: [/^@maschina\//],
	},
});
