import { defineConfig } from "vitest/config";

// Runs every workspace's unit tests as one suite, for editors and `vitest` at the root.
// CI runs them per package through Turborepo instead, so results are cached.
export default defineConfig({
	test: {
		projects: ["apps/*", "services/*", "packages/*", "!packages/integration-tests"],
	},
});
