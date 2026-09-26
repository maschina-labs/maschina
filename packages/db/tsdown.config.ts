import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/migrate.ts"],
	format: "esm",
	platform: "node",
	target: "node24",
	sourcemap: true,
	clean: true,
	// The same rule the services use: workspace code is compiled in, everything from npm stays external
	// and is installed next to the bundle.
	deps: {
		neverBundle: true,
		alwaysBundle: [/^@maschina\//],
	},
});
