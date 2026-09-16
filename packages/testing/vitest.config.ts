import { vitestConfig } from "@maschina/config/vitest";

export default vitestConfig({
	// Covered by packages/integration-tests, which needs Docker.
	coverageExclude: ["src/database.ts"],
});
