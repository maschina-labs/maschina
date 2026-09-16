import { vitestConfig } from "@maschina/config/vitest";

export default vitestConfig({
	// Starting a real listener is covered by each service's own tests.
	coverageExclude: ["src/start.ts", "src/test-logger.ts"],
});
