import { vitestConfig } from "@maschina/config/vitest";

export default vitestConfig({
	// Better Auth wired to a real database: proved over its real HTTP surface in packages/integration-tests.
	coverageExclude: ["src/accounts.ts"],
});
